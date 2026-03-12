/* ============================================================
   server.js  —  Portfolio + Project Feedback (all-in-one)
   No separate route files, no separate model files.
   ============================================================ */
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

/* ── 1. MongoDB Connection ─────────────────────────────────────────────────
   Set MONGODB_URI env variable before starting the server, e.g.:
     MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/portfolio
   Falls back to local MongoDB for development.                             */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/portfolio';

mongoose
    .connect(MONGODB_URI)
    .then(function () {
        console.log('✅  MongoDB connected:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));
    })
    .catch(function (err) {
        console.error('❌  MongoDB connection error:', err.message);
        // Server keeps running — static pages still load even if DB is unavailable
    });

/* ── 2. Feedback Schema & Model ────────────────────────────────────────────
   Defined inline — no separate /models directory needed.                   */
const feedbackSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    likedMost: {
        type: [String],
        required: [true, 'Please select at least one thing you liked'],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'Please select at least one thing you liked'
        }
    },
    message: {
        type: String,
        required: [true, 'Feedback message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    recommend: {
        type: Boolean,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

/* ── 3. Middleware ─────────────────────────────────────────────────────────*/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── 4. POST /submit-feedback ──────────────────────────────────────────────
   Receives form data, sanitizes, validates, stores in MongoDB.             */
app.post('/submit-feedback', async function (req, res) {
    try {
        var body = req.body;

        /* Basic server-side sanity checks (client also validates, but never trust only the client) */
        if (!body.name || !body.name.toString().trim()) {
            return res.status(400).json({ success: false, error: 'Name is required.' });
        }
        if (!body.email || !body.email.toString().trim()) {
            return res.status(400).json({ success: false, error: 'Email is required.' });
        }
        var likedMost = Array.isArray(body.likedMost) ? body.likedMost : [];
        if (likedMost.length === 0) {
            return res.status(400).json({ success: false, error: 'Please select at least one thing you liked.' });
        }
        if (!body.message || !body.message.toString().trim()) {
            return res.status(400).json({ success: false, error: 'Feedback message is required.' });
        }

        /* Strip any HTML tags from string fields before saving */
        function sanitize(str) {
            return typeof str === 'string' ? str.replace(/<[^>]*>/g, '').trim() : str;
        }

        var recommend = null;
        if (body.recommend === true || body.recommend === 'true') recommend = true;
        if (body.recommend === false || body.recommend === 'false') recommend = false;

        var feedback = new Feedback({
            name: sanitize(body.name),
            email: sanitize(body.email),
            likedMost: likedMost.map(sanitize),
            message: sanitize(body.message),
            recommend: recommend
        });

        await feedback.save();

        return res.status(201).json({ success: true, message: 'Feedback submitted successfully' });

    } catch (err) {
        /* Mongoose validation errors */
        if (err.name === 'ValidationError') {
            var messages = Object.values(err.errors).map(function (e) { return e.message; });
            return res.status(400).json({ success: false, error: messages.join(' ') });
        }
        console.error('POST /submit-feedback error:', err);
        return res.status(500).json({ success: false, error: 'Server error. Please try again later.' });
    }
});

/* ── 5. Page Route ─────────────────────────────────────────────────────────*/
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ── 6. Start server ───────────────────────────────────────────────────────*/
app.listen(PORT, function () {
    console.log('🚀  Server running at http://localhost:' + PORT);
});
