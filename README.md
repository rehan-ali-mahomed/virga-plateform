# Vehicle Inspection Report Application

This application is designed to streamline the process of creating and managing vehicle inspection reports for auto repair shops.

## Features

- User authentication
- Create and submit vehicle inspection reports
- View and download inspection reports as PDFs
- Dashboard to manage and preview reports

## Technologies Used

- Node.js
- Express.js
- SQLite
- EJS (Embedded JavaScript templating)
- Bootstrap 4
- Font Awesome

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory and add the following:
   ```
   SESSION_SECRET=your_session_secret_here
   ```

4. Start the application:
   ```
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Log in using the default credentials:
   - Username: admin
   - Password: password

2. Use the dashboard to create new inspection reports or view existing ones.

3. Fill out the inspection form with vehicle and client details.

4. Submit the form to generate a PDF report.

5. View or download the generated reports from the dashboard.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[ISC](https://choosealicense.com/licenses/isc/)