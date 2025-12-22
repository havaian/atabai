const multer = require('multer');
const crypto = require('crypto');
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
        // Generate UUID filename to avoid encoding issues
        const uniqueId = crypto.randomUUID();
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueId}${ext}`);
    }
});

// File filter - only allow Excel files
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
        return cb(new Error('Only .xlsx and .xls files are allowed'), false);
    }
    cb(null, true);
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