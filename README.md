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

## New Feature: Server-side PDF Generation and Preview

This project now includes a feature to generate PDFs on the server-side and preview them in the browser without downloading. Here's how it works:

1. The server generates a PDF based on a template (`views/pdf-template.ejs`).
2. The generated PDF is saved temporarily on the server.
3. A URL for the PDF is sent to the client.
4. The client displays the PDF in an iframe for preview.

To use this feature:
1. Click the "Preview PDF" button on the dashboard.
2. The PDF will be generated and displayed in the preview container.

Note: Generated PDFs are temporary and will be cleaned up periodically.

## Installation and Setup

(Existing installation instructions...)

Make sure to install the additional package:

## New Feature: PDF Download and Preview

This project now includes features to download and preview PDF reports directly from the dashboard. Here's how it works:

1. On the dashboard, each report has two action buttons:
   - "Télécharger" (Download): Allows you to download the PDF report.
   - "Aperçu" (Preview): Opens a modal with a preview of the PDF report.

2. The PDF is generated on-demand when either action is triggered.

3. For preview, the PDF is displayed in an iframe within a modal, allowing users to view the report without leaving the dashboard.

4. For download, the PDF is generated and sent to the browser for download.

## Usage

1. Navigate to the dashboard after logging in.
2. For each report, you will see two buttons:
   - Click "Télécharger" to download the PDF report.
   - Click "Aperçu" to open a preview of the PDF in a modal.

## Installation and Setup

(Existing installation instructions...)

Make sure all dependencies are installed:
