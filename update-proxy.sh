#!/bin/bash

# Directory to store instance metadata
INSTANCES_FILE="instances/active_instances.txt"
HAPROXY_MAP="/etc/haproxy/domain2backend.map"
HAPROXY_BACKENDS_DIR="/etc/haproxy/backends"
HAPROXY_CONFIG_TEMPLATE="/home/amadiyadm/proxy-settings/haproxy.cfg.template"
HAPROXY_CONFIG="/etc/haproxy/haproxy.cfg"
PROXY_TMP_DIR="/tmp/haproxy-manager"
# PROXY_MANAGER_DIR="/home/amadiyadm/proxy-settings"

# Create necessary directories
mkdir -p instances "${PROXY_TMP_DIR}"
sudo mkdir -p "$HAPROXY_BACKENDS_DIR"

# Function to cleanup temporary files
cleanup() {
    # rm -rf "${PROXY_TMP_DIR}"/*
    echo "Cleaning temporary files at ${PROXY_TMP_DIR}"
}

# Set trap for cleanup
trap cleanup EXIT

# Function to update HAProxy configuration
update_haproxy_config() {
    # Copy base template to temp location
    cp "$HAPROXY_CONFIG_TEMPLATE" "${PROXY_TMP_DIR}/haproxy.cfg"
    
    # Ensure map file directory exists
    sudo mkdir -p "$(dirname "$HAPROXY_MAP")"
    
    # Create empty map file if it doesn't exist
    [[ ! -f "$HAPROXY_MAP" ]] && sudo touch "$HAPROXY_MAP"
    
    # Move config to final location
    sudo mv "${PROXY_TMP_DIR}/haproxy.cfg" "$HAPROXY_CONFIG"
}

# Function to add/update backend configuration
update_backend_config() {
    local company_dir="$1"
    local port="$2"
    local server_ip="$3"
    
    # Create backend configuration in temp location
    cat << EOF > "${PROXY_TMP_DIR}/${company_dir}.cfg"
backend ${company_dir}_backend
    mode http
    server ${company_dir}_server ${server_ip}:${port} check
EOF

    # Move to final location
    sudo mv "${PROXY_TMP_DIR}/${company_dir}.cfg" "$HAPROXY_BACKENDS_DIR/"
}

# Function to add/update instance
add_update_instance() {
    local company_dir="$1"
    local port="$2"
    local domain="$3"
    local server_ip="$4"

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
    
    # Get domain before removing from instances file
    local domain=$(grep "^${company_dir}|" "$INSTANCES_FILE" | cut -d'|' -f3)
    
    # Remove from instances file
    sed -i "/^${company_dir}|/d" "$INSTANCES_FILE"
    
    # Remove backend configuration
    sudo rm -f "$HAPROXY_BACKENDS_DIR/${company_dir}.cfg"
    
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

# Main logic based on command
case "$1" in
    "add")
        if [ "$#" -ne 5 ]; then
            echo "Usage: $0 add <company_dir> <port> <domain> <server_ip>"
            exit 1
        fi
        update_haproxy_config
        add_update_instance "$2" "$3" "$4" "$5"
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
        echo "Usage: $0 {add|remove|list} [args...]"
        exit 1
        ;;
esac 
