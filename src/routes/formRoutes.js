const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { submitForm } = require('../controllers/formController');
const { 
  getInspectionItems, 
  getAllVehicules, 
  getVehiculeById, 
  getCustomerById, 
  updateInspectionReports, 
  getAllActiveUsers,
  getUserById,
  getAllCustomers
} = require('../config/database');
const logger = require('../utils/logger');

// Add route to get all vehicules
router.get('/api-vehicules', isAuthenticated, async (req, res) => {
  try {
    const vehicules = await getAllVehicules();
    const formattedVehicules = vehicules.map(vehicule => ({
      vehicule_id: vehicule.vehicule_id,
      license_plate: vehicule.license_plate,
      brand: vehicule.brand,
      model: vehicule.model
    }));

    res.json({
      success: true,
      data: formattedVehicules
    });
  } catch (error) {
    logger.error('Error fetching vehicules:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la récupération des véhicules'
    });
  }
});

// Get the vehicule and client information from license plate
router.get('/api-vehicule-details/:id', isAuthenticated, async (req, res) => {
  try {
    const vehicule_id = req.params.id;
    
    if (vehicule_id && vehicule_id.length > 0) {
      logger.debug(`Searching for vehicule with id: [${vehicule_id}]`);
      const vehicule = await getVehiculeById(vehicule_id);
      const users = await getAllActiveUsers();
      const mechanicsList = users.filter(user => user.role === 'mechanic');

      logger.debug(`Searching for customer with id: [${vehicule.customer_id}]`);
      const customer = await getCustomerById(vehicule.customer_id);

      const formattedCustomer = {
        customer_id: customer.customer_id,
        client_name: customer.name,
        client_phone: customer.phone,
        client_email: customer.email,
        client_address: customer.address,
        is_company: customer.is_company
      };

      logger.debug('Vehicule and customer found');

      res.json({
        success: true,
        vehicule: vehicule,
        customer: formattedCustomer,
        mechanics: mechanicsList
      });
    } else {
      res.json({
        success: false,
        message: 'Aucune informations trouvées avec cette immatriculation'
      });
    }
  } catch (error) {
    logger.error('Error searching for vehicule:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la recherche'
    });
  }
});

// Get user details with id
router.get('/api-user-details/:id', isAuthenticated, async (req, res) => {
  try {
    const user_id = req.params.id;
    const user = await getUserById(user_id);

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    logger.error('Error searching for user:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la recherche'
    });
  }
});

// Add route to search customers by name
router.get('/api-customers-search', isAuthenticated, async (req, res) => {
  try {
    const searchQuery = req.query.query;
    const customers = await getAllCustomers();
    
    const filteredCustomers = customers.filter(customer => 
      customer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formattedCustomers = filteredCustomers.map(customer => ({
      customer_id: customer.customer_id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      is_company: customer.is_company
    }));

    res.json({
      success: true,
      data: formattedCustomers
    });
  } catch (error) {
    logger.error('Error searching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Une erreur est survenue lors de la recherche des clients'
    });
  }
});

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    const users = await getAllActiveUsers();
    const mechanicsList = users.filter(user => user.role === 'mechanic');
    
    // Sort inspection items to match our desired order
    const categoryOrder = [
      'Intérieur',
      'Moteur',
      'Direction Avant',
      'Direction Arrière',
      'Accessoires',
      'Travaux terminés'
    ];

    const sortedInspectionItems = inspectionItems.sort((a, b) => {
      const categoryA = categoryOrder.indexOf(a.category);
      const categoryB = categoryOrder.indexOf(b.category);
      
      if (categoryA === categoryB) {
        return a.display_order - b.display_order;
      }
      return categoryA - categoryB;
    });
    
    res.render('form', { 
      errors: null, 
      data: {}, 
      inspectionItems: sortedInspectionItems,
      mechanicsList,
      user: req.session.user
    });
  } catch (error) {
    res.status(500).render('error', { 
      message: 'Error loading form',
      error: error
    });
  }
});

router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    const users = await getAllActiveUsers();
    const mechanicsList = users.filter(user => user.role === 'mechanic');

    // Sort inspection items to match our desired order
    const categoryOrder = [
      'Intérieur',
      'Moteur',
      'Direction Avant',
      'Direction Arrière',
      'Accessoires',
      'Travaux terminés'
    ];

    const sortedInspectionItems = inspectionItems.sort((a, b) => {
      const categoryA = categoryOrder.indexOf(a.category);
      const categoryB = categoryOrder.indexOf(b.category);
      
      if (categoryA === categoryB) {
        return a.display_order - b.display_order;
      }
      return categoryA - categoryB;
    });

    res.render('form', { 
      errors: null, 
      data: {}, 
      inspectionItems: sortedInspectionItems,
      mechanicsList,
      user: req.session.user
    });
  } catch (error) {
    logger.error('Error loading form:', error);
    res.status(500).render('error', { 
      message: 'Error loading form',
      error: error
    });
  }
});

router.post('/submit', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    req.inspectionItems = inspectionItems;
    const userId = req.user.id;
   
    await submitForm(req, res, userId);
  } catch (error) {
    res.status(500).render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
});

router.post('/submit-preview', isAuthenticated, async (req, res) => {
  try {
    const inspectionItems = await getInspectionItems();
    req.inspectionItems = inspectionItems;
    const userId = req.user.id;
   
    const reportId = await submitForm(req, res, userId, true);
    return res.redirect(`/report/preview/${reportId}`);
  
  } catch (error) {
    res.status(500).render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de l\'enregistrement.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
});

router.post('/update/:id', isAuthenticated, async (req, res) => {
  try {
    logger.debug(`Received update request for report ID: ${req.params.id}`);
    
    const inspectionItems = await getInspectionItems();
    req.inspectionItems = inspectionItems;
    const userId = req.user.id;

    const reportId = await updateInspectionReports(req.params.id, req.body, userId);
    
    logger.debug(`Report updated successfully with ID: ${reportId}`);
    
    return res.redirect(`/report/${reportId}`);
  } catch (error) {
    logger.error('Error updating form:', error);
    res.status(500).render('form', {
      data: req.body,
      errors: [{ msg: 'Une erreur est survenue lors de la mise à jour.' }],
      inspectionItems: req.inspectionItems || []
    });
  }
});

module.exports = router;