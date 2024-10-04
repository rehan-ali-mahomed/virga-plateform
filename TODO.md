# Vehicle Inspection App - ToDo List

## High Priority

1. PDF Generation
   - [ ] Remove unused `html-pdf` package from `app.js` and `package.json`
   - [ ] Ensure `PDFKit` is consistently used for PDF generation across the application

2. Database Operations
   - [ ] Standardize the use of `getDatabase()` function across all routes and services

3. Form Validation
   - [x] Update form submission route in `form.ejs`
   - [x] Implement form submission handling in `form.js`
   - [x] Update `validateForm` middleware in `validation.js` to match the fields in `form.ejs`
   - [x] Implement comprehensive client-side validation in `script.js`

4. Error Handling
   - [ ] Implement consistent use of `errorHandler` middleware across all routes

5. Session Management
   - [ ] Uncomment and properly configure `SQLiteStore` for session persistence

6. Logging
   - [ ] Replace all instances of `console.log` with the custom logger from `logger.js`

7. Authentication
   - [ ] Consolidate authentication logic from `authMiddleware.js` and `auth.js`
   - [ ] Implement user registration functionality

8. Report Routes
   - [ ] Implement the `/report/:id` route for viewing a single report

## Medium Priority

9. Environment Variables
   - [ ] Utilize environment variables for configuration (e.g., database path, port number)

10. Testing
    - [ ] Set up a comprehensive test suite for the entire application
    - [ ] Expand on the existing `pdfGenerator.test.js`

11. PDF Preview
    - [ ] Differentiate between preview and download functionality in `report.js`

12. Security
    - [ ] Implement CSRF protection
    - [ ] Review and enhance Content Security Policy in `app.js`

13. User Management
    - [ ] Implement password reset functionality
    - [ ] Add user profile management features

## Low Priority

14. Code Optimization
    - [ ] Refactor repetitive code in route handlers
    - [ ] Optimize database queries for better performance

15. Frontend Enhancements
    - [ ] Improve responsive design for mobile devices
    - [ ] Enhance user interface with more interactive elements

16. Documentation
    - [ ] Update README with comprehensive setup and usage instructions
    - [ ] Add inline code documentation for complex functions

17. Accessibility
    - [ ] Ensure the application meets WCAG 2.1 guidelines

18. Internationalization
    - [ ] Implement multi-language support

19. Performance Monitoring
    - [ ] Integrate application performance monitoring tools

20. Backup and Recovery
    - [ ] Implement automated database backup system

## Ongoing

- [ ] Keep dependencies up-to-date
- [ ] Regularly review and update security measures
- [ ] Monitor and address technical debt