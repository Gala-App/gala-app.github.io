# Gala website

The Official App for Party Planning

## Project Structure

```
.
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── .env               # Environment variables
├── .gitignore         # Git ignore rules
├── routes/            # Route handlers
│   └── index.js       # Main routes
└── docs/            # Static files
    ├── index.html     # Home page
    ├── 404.html       # 404 error page
    ├── css/
    │   └── styles.css # Stylesheet
    └── js/
        └── main.js    # Client-side JavaScript
```

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Run in production:**
   ```bash
   npm start
   ```

4. **Access the site:**
   Open your browser and navigate to `http://localhost:3000`