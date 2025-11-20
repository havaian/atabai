const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = '/uploads';

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate a unique filename to prevent collisions
        const uniqueFilename = `file-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueFilename);
    }
});

// File filter - only allow Excel files
const fileFilter = (req, file, cb) => {
    // Allowed Excel file types
    const allowedTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only Excel files (.xls, .xlsx) are allowed.'), false);
    }
};

// Size limits
const limits = {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
};

// Initialize multer upload
const upload = multer({
    storage,
    fileFilter,
    limits
});

module.exports = upload;