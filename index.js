require('dotenv').config()
const dns = require('node:dns')
dns.setServers(['1.1.1.1', '8.8.8.8'])

const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const cloudinary = require('cloudinary').v2

const app = express()
app.use(express.json())
app.use(cors())

// ── ADMIN AUTH (HTTP Basic Auth) ──
const ADMIN_USER = process.env.ADMIN_USER
const ADMIN_PASS = process.env.ADMIN_PASSWORD

function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Luminary Admin"')
        return res.status(401).send('Authentication required')
    }
    const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8')
    const [user, pass] = decoded.split(':')
    if (user === ADMIN_USER && pass === ADMIN_PASS) return next()
    res.set('WWW-Authenticate', 'Basic realm="Luminary Admin"')
    return res.status(401).send('Invalid credentials')
}

// Protect admin.html itself — must come BEFORE express.static
app.get('/admin.html', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'))
})

app.use(express.static('public'))

// ── CLOUDINARY CONFIG (replaces local disk storage) ──
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

// Store the upload in memory (as a buffer) instead of on disk,
// then hand that buffer to Cloudinary ourselves — no extra package needed.
const storage = multer.memoryStorage()

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/
        if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true)
        else cb(new Error('Only image files allowed!'))
    }
})

function uploadBufferToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'luminary-artworks' },
            (error, result) => error ? reject(error) : resolve(result)
        )
        stream.end(buffer)
    })
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected!'))
    .catch(err => console.error('❌ Failed:', err.message))

// ── SCHEMAS ──
const artworkSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    featured: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
})

const commissionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    type: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
})

const testimonialSchema = new mongoose.Schema({
    name: { type: String, required: true },
    review: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    artType: { type: String },
    createdAt: { type: Date, default: Date.now }
})

const Artwork = mongoose.model('Artwork', artworkSchema)
const Commission = mongoose.model('Commission', commissionSchema)
const Testimonial = mongoose.model('Testimonial', testimonialSchema)

// ── ARTWORK ROUTES ──

// GET all artworks (with optional search & filter) — public
app.get('/artworks', async (req, res) => {
    try {
        const { category, search } = req.query
        let query = {}
        if (category && category !== 'all') query.category = category
        if (search) query.title = { $regex: search, $options: 'i' }
        const artworks = await Artwork.find(query).sort({ createdAt: -1 })
        res.status(200).json({ success: true, count: artworks.length, data: artworks })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// GET featured artworks — public
app.get('/artworks/featured', async (req, res) => {
    try {
        const artworks = await Artwork.find({ featured: true })
        res.status(200).json({ success: true, data: artworks })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// POST upload artwork (with image) — ADMIN ONLY
app.post('/artworks', requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { title, category, description, featured } = req.body
        if (!title || !category || !description || !req.file)
            return res.status(400).json({ success: false, message: 'All fields and image required!' })
        const result = await uploadBufferToCloudinary(req.file.buffer)
        const artwork = new Artwork({
            title, category, description,
            imageUrl: result.secure_url,
            imagePublicId: result.public_id,
            featured: featured === 'true'
        })
        await artwork.save()
        res.status(201).json({ success: true, message: 'Artwork uploaded!', data: artwork })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// DELETE artwork — ADMIN ONLY
app.delete('/artworks/:id', requireAdmin, async (req, res) => {
    try {
        const artwork = await Artwork.findById(req.params.id)
        if (!artwork) return res.status(404).json({ success: false, message: 'Artwork not found!' })
        // Delete image from Cloudinary
        await cloudinary.uploader.destroy(artwork.imagePublicId)
        await artwork.deleteOne()
        res.status(200).json({ success: true, message: 'Artwork deleted!' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── COMMISSION ROUTES ──

// POST contact/commission request — public
app.post('/contact', async (req, res) => {
    const { name, email, phone, type, message } = req.body
    if (!name || !email || !type || !message)
        return res.status(400).json({ success: false, message: 'All fields required!' })
    try {
        const commission = new Commission({ name, email, phone, type, message })
        await commission.save()
        res.status(201).json({ success: true, message: 'Commission request saved!', data: commission })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// GET all commissions — ADMIN ONLY
app.get('/commissions', requireAdmin, async (req, res) => {
    try {
        const commissions = await Commission.find().sort({ createdAt: -1 })
        res.status(200).json({ success: true, count: commissions.length, data: commissions })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// PATCH commission status — ADMIN ONLY
app.patch('/commissions/:id', requireAdmin, async (req, res) => {
    try {
        const commission = await Commission.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        )
        if (!commission) return res.status(404).json({ success: false, message: 'Not found!' })
        res.status(200).json({ success: true, data: commission })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── TESTIMONIAL ROUTES ──

// POST testimonial — public
app.post('/testimonials', async (req, res) => {
    const { name, review, rating, artType } = req.body
    if (!name || !review || !rating)
        return res.status(400).json({ success: false, message: 'Name, review and rating required!' })
    try {
        const testimonial = new Testimonial({ name, review, rating, artType })
        await testimonial.save()
        res.status(201).json({ success: true, data: testimonial })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// GET testimonials — public
app.get('/testimonials', async (req, res) => {
    try {
        const testimonials = await Testimonial.find().sort({ createdAt: -1 })
        res.status(200).json({ success: true, data: testimonials })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── ADMIN DASHBOARD DATA — ADMIN ONLY ──
app.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [artworks, commissions, testimonials, pending] = await Promise.all([
            Artwork.countDocuments(),
            Commission.countDocuments(),
            Testimonial.countDocuments(),
            Commission.countDocuments({ status: 'pending' })
        ])
        res.status(200).json({ success: true, data: { artworks, commissions, testimonials, pending } })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── ERROR HANDLER (Multer errors, unhandled errors → always return JSON) ──
app.use((err, req, res, next) => {
    console.error(err)
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image must be under 5MB!' })
    }
    res.status(500).json({ success: false, message: err.message || 'Something went wrong on the server.' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 Luminary running on port ${PORT}`))