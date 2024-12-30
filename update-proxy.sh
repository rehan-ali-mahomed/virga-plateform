#!/bin/bash

# Directory to store instance metadata
INSTANCES_FILE="instances/active_instances.txt"
HAPROXY_MAP="/etc/haproxy/domain2backend.map"
HAPROXY_CONFIG_TEMPLATE="/home/amadiyadm/proxy-settings/haproxy.cfg.template"
HAPROXY_CONFIG="/etc/haproxy/haproxy.cfg"
PROXY_TMP_DIR="/tmp/haproxy-manager"
# PROXY_MANAGER_DIR="/home/amadiyadm/proxy-settings"

# Create necessary directories
mkdir -p instances "${PROXY_TMP_DIR}"

# Function to cleanup temporary files
cleanup() {
    # rm -rf "${PROXY_TMP_DIR}"/*
    echo "Cleaning temporary files at ${PROXY_TMP_DIR}"
}

# Set trap for cleanup
trap cleanup EXIT

# Function to update HAProxy configuration
update_haproxy_config() {
    # Check if main config exists, if not, create from template
    if [ ! -f "$HAPROXY_CONFIG" ]; then
        # Ensure directory exists
        if ! sudo mkdir -p "$(dirname "$HAPROXY_CONFIG")"; then
            echo "Error: Failed to create config directory"
            return 1
        fi
        
        # Template is required for initial setup
        if [ ! -f "$HAPROXY_CONFIG_TEMPLATE" ]; then
            echo "Error: Template file not found: $HAPROXY_CONFIG_TEMPLATE"
            echo "A proper HAProxy configuration template is required for initial setup"
            return 1
        fi
        
        if ! sudo cp "$HAPROXY_CONFIG_TEMPLATE" "$HAPROXY_CONFIG"; then
            echo "Error: Failed to create initial config from template"
            return 1
        fi
    fi

    # Ensure map file directory exists
    if ! sudo mkdir -p "$(dirname "$HAPROXY_MAP")"; then
        echo "Error: Failed to create map directory"
        return 1
    fi
    
    # Create empty map file if it doesn't exist
    if [ ! -f "$HAPROXY_MAP" ]; then
        if ! sudo touch "$HAPROXY_MAP"; then
            echo "Error: Failed to create map file"
            return 1
        fi
    fi

    # Ensure the backend marker exists in the config
    if ! sudo grep -q "^# ---SCRIPTED BACKENDS---" "$HAPROXY_CONFIG"; then
        echo -e "\n# ---SCRIPTED BACKENDS---" | sudo tee -a "$HAPROXY_CONFIG" > /dev/null
        echo "# Backends will be automatically added below this line by the update script" | sudo tee -a "$HAPROXY_CONFIG" > /dev/null
    fi
}

# Function to add/update backend configuration
update_backend_config() {
    local company_dir="$1"
    local port="$2"
    local server_ip="$3"
    
    # Setup backup directory and files
    local backup_dir="/var/backups/haproxy"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/haproxy_${timestamp}.cfg"
    local metadata_file="${backup_dir}/haproxy_${timestamp}.meta"
    
    # Create backup directory if it doesn't exist
    if ! sudo mkdir -p "$backup_dir"; then
        echo "Error: Failed to create backup directory"
        return 1
    fi

    # Create backup with metadata
    if ! sudo cp "$HAPROXY_CONFIG" "$backup_file"; then
        echo "Error: Failed to create backup of current config"
        return 1
    fi

    # Save metadata about the modification
    local modification_type="New backend"
    local old_config=""
    
    # Check if this is an update or new backend
    if grep -q "^${company_dir}|" "$INSTANCES_FILE" 2>/dev/null; then
        modification_type="Update backend"
        old_config=$(grep "^backend ${company_dir}_backend" -A 2 "$HAPROXY_CONFIG" || echo "Not found")
    fi
    
    cat << EOF | sudo tee "$metadata_file" > /dev/null
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
Action: ${modification_type}
Company: ${company_dir}
Domain: $(grep "^${company_dir}|" "$INSTANCES_FILE" 2>/dev/null | cut -d'|' -f3 || echo "New domain")

Previous Configuration:
${old_config:-"New backend - no previous configuration"}

New Configuration:
backend ${company_dir}_backend
    mode http
    server ${company_dir}_server ${server_ip}:${port} check

Changes:
- Company Directory: ${company_dir}
- Port: ${port}
- Server IP: ${server_ip}
- Domain Mapping: $(grep "^${company_dir}|" "$INSTANCES_FILE" 2>/dev/null | cut -d'|' -f3 || echo "New mapping")

User: $(whoami)
Command: $0 $*
EOF

    # Create temporary file for the new config
    local temp_config="${PROXY_TMP_DIR}/haproxy.cfg.tmp"
    
    # Find the line number of the backend marker
    local marker_line=$(sudo grep -n "^# ---SCRIPTED BACKENDS---" "$HAPROXY_CONFIG" | cut -d: -f1)
    
    if [ -z "$marker_line" ]; then
        echo "Error: Backend marker not found in config"
        return 1
    fi
    
    # Copy the config up to the marker line
    if ! sudo head -n "$marker_line" "$HAPROXY_CONFIG" > "$temp_config"; then
        echo "Error: Failed to process config file"
        sudo cp "$backup_file" "$HAPROXY_CONFIG"
        return 1
    fi
    
    # Add the marker
    echo "# ---SCRIPTED BACKENDS---" >> "$temp_config"
    echo "# Backends will be automatically added below this line by the update script" >> "$temp_config"
    
    # Add all backends from the instances file
    while IFS='|' read -r dir p domain ip; do
        if [ "$dir" = "$company_dir" ]; then
            # Use new values for updating instance
            echo -e "\nbackend ${dir}_backend\n    mode http\n    server ${dir}_server ${server_ip}:${port} check" >> "$temp_config"
        else
            # Keep existing backend configuration
            echo -e "\nbackend ${dir}_backend\n    mode http\n    server ${dir}_server ${ip}:${p} check" >> "$temp_config"
        fi
    done < "$INSTANCES_FILE"
    
    # If this is a new backend not in instances file yet
    if ! grep -q "^${company_dir}|" "$INSTANCES_FILE"; then
        echo -e "\nbackend ${company_dir}_backend\n    mode http\n    server ${company_dir}_server ${server_ip}:${port} check" >> "$temp_config"
    fi
    
    # Validate the new config
    if ! sudo haproxy -c -f "$temp_config"; then
        echo "Error: New configuration is invalid"
        sudo cp "$backup_file" "$HAPROXY_CONFIG"
        return 1
    fi
    
    # Replace the old config with the new one
    if ! sudo mv "$temp_config" "$HAPROXY_CONFIG"; then
        echo "Error: Failed to update configuration"
        sudo cp "$backup_file" "$HAPROXY_CONFIG"
        return 1
    fi
    
    # Remove backup if everything succeeded
    sudo rm -f "$backup_file"
}

# Function to validate domain format
validate_domain() {
    local domain="$1"
    if ! echo "$domain" | grep -qP '^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$'; then
        echo "Error: Invalid domain format: $domain"
        return 1
    fi
    return 0
}

# Function to add/update instance
add_update_instance() {
    local company_dir="$1"
    local port="$2"
    local domain="$3"
    local server_ip="$4"

    # Validate domain format
    if ! validate_domain "$domain"; then
        echo "Error: Instance creation failed due to invalid domain format"
        return 1
    }

    # Update instances file
    if grep -q "^${company_dir}|" "$INSTANCES_FILE" 2>/dev/null; then
        sed -i "s|^${company_dir}|.*|${company_dir}|${port}|${domain}|${server_ip}|" "$INSTANCES_FILE"
    else
        echo "${company_dir}|${port}|${domain}|${server_ip}" >> "$INSTANCES_FILE"
    fi
    sort -u "$INSTANCES_FILE" -o "$INSTANCES_FILE"

    # Update backend configuration
    update_backend_config "$company_dir" "$port" "$server_ip"

    # Update domain mapping
    if sudo grep -q "^${domain}" "$HAPROXY_MAP" 2>/dev/null; then
        sudo sed -i "s|^${domain}.*|${domain} ${company_dir}_backend|" "$HAPROXY_MAP"
    else
        echo "${domain} ${company_dir}_backend" | sudo tee -a "$HAPROXY_MAP" > /dev/null
    fi
}

# Function to remove instance
remove_instance() {
    local company_dir="$1"
    
    # Setup backup directory and files
    local backup_dir="/var/backups/haproxy"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/haproxy_${timestamp}.cfg"
    local metadata_file="${backup_dir}/haproxy_${timestamp}.meta"
    
    # Create backup directory if it doesn't exist
    if ! sudo mkdir -p "$backup_dir"; then
        echo "Error: Failed to create backup directory"
        return 1
    fi

    # Create backup with metadata
    if ! sudo cp "$HAPROXY_CONFIG" "$backup_file"; then
        echo "Error: Failed to create backup of current config"
        return 1
    fi
    
    # Get instance information before removal
    local instance_info=$(grep "^${company_dir}|" "$INSTANCES_FILE")
    local domain=$(echo "$instance_info" | cut -d'|' -f3)
    local port=$(echo "$instance_info" | cut -d'|' -f2)
    local server_ip=$(echo "$instance_info" | cut -d'|' -f4)
    local backend_config=$(grep "^backend ${company_dir}_backend" -A 2 "$HAPROXY_CONFIG" || echo "Not found")
    
    # Save metadata about the removal
    cat << EOF | sudo tee "$metadata_file" > /dev/null
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
Action: Remove backend
Company: ${company_dir}

Removed Configuration:
Instance Information:
- Domain: ${domain}
- Port: ${port}
- Server IP: ${server_ip}

Backend Configuration:
${backend_config}

Domain Mapping:
$(grep "^${domain}" "$HAPROXY_MAP" || echo "No mapping found")

User: $(whoami)
Command: $0 $*
EOF
    
    # Remove from instances file
    sed -i "/^${company_dir}|/d" "$INSTANCES_FILE"
    
    # Remove backend configuration from main config
    sudo sed -i "/^backend ${company_dir}_backend/,/^$/d" "$HAPROXY_CONFIG"
    
    # Remove from domain mapping
    if [ ! -z "$domain" ]; then
        sudo sed -i "/^${domain}/d" "$HAPROXY_MAP"
    fi
}

# Function to reload HAProxy
reload_haproxy() {
    echo "Validating HAProxy configuration..."
    if sudo haproxy -c -f "$HAPROXY_CONFIG"; then
        echo "Configuration valid. Reloading HAProxy..."
        sudo systemctl reload haproxy
        return $?
    else
        echo "Error: Invalid HAProxy configuration"
        return 1
    fi
}

# Function to list and restore backups
list_restore_backups() {
    local action="$1"
    local backup_dir="/var/backups/haproxy"
    
    case "$action" in
        "list")
            echo "Available backups:"
            echo "----------------------------------------"
            for meta in $(sudo find "$backup_dir" -name "*.meta" | sort -r); do
                echo -e "\nBackup: $(basename ${meta%.meta})"
                sudo cat "$meta"
            done
            ;;
        "restore")
            local backup_id="$2"
            if [ -z "$backup_id" ]; then
                echo "Error: Backup ID required"
                return 1
            fi
            
            local backup_file="${backup_dir}/haproxy_${backup_id}.cfg"
            if [ ! -f "$backup_file" ]; then
                echo "Error: Backup file not found: $backup_file"
                return 1
            }
            
            # Validate the backup config
            if ! sudo haproxy -c -f "$backup_file"; then
                echo "Error: Backup configuration is invalid"
                return 1
            }
            
            # Create a backup of current config before restore
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local pre_restore_backup="${backup_dir}/haproxy_${timestamp}_pre_restore.cfg"
            local pre_restore_meta="${backup_dir}/haproxy_${timestamp}_pre_restore.meta"
            
            sudo cp "$HAPROXY_CONFIG" "$pre_restore_backup"
            cat << EOF | sudo tee "$pre_restore_meta" > /dev/null
Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
Action: Pre-restore backup
User: $(whoami)
Command: $0 $*
Restoring to: ${backup_id}
EOF
            
            # Restore the backup
            if ! sudo cp "$backup_file" "$HAPROXY_CONFIG"; then
                echo "Error: Failed to restore backup"
                return 1
            }
            
            echo "Successfully restored backup: $backup_id"
            return 0
            ;;
        *)
            echo "Usage: $0 {list-backups|restore-backup <backup_id>}"
            return 1
            ;;
    esac
}

# Main logic based on command
case "$1" in
    "add")
        if [ "$#" -ne 5 ]; then
            echo "Usage: $0 add <company_dir> <port> <domain> <server_ip>"
            exit 1
        fi
        update_haproxy_config
        if ! add_update_instance "$2" "$3" "$4" "$5"; then
            echo "Failed to add/update instance"
            exit 1
        fi
        reload_haproxy
        ;;
    "remove")
        if [ "$#" -ne 2 ]; then
            echo "Usage: $0 remove <company_dir>"
            exit 1
        fi
        remove_instance "$2"
        reload_haproxy
        ;;
    "list-backups")
        list_restore_backups "list"
        ;;
    "restore-backup")
        if [ "$#" -ne 2 ]; then
            echo "Usage: $0 restore-backup <backup_id>"
            exit 1
        fi
        if list_restore_backups "restore" "$2"; then
            reload_haproxy
        fi
        ;;
    "list")
        if [ -f "$INSTANCES_FILE" ]; then
            echo "Active instances:"
            echo "COMPANY DIR | PORT | DOMAIN | SERVER IP"
            echo "----------------------------------------"
            cat "$INSTANCES_FILE"
            echo -e "\nDomain mappings:"
            sudo cat "$HAPROXY_MAP"
        else
            echo "No active instances"
        fi
        ;;
    *)
        echo "Usage: $0 {add|remove|list|list-backups|restore-backup} [args...]"
        exit 1
        ;;
esac 
