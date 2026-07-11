const cursor = document.getElementById('cursor')
const trail = document.getElementById('cursorTrail')
document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px'
    cursor.style.top = e.clientY + 'px'
    setTimeout(() => { trail.style.left = e.clientX + 'px'; trail.style.top = e.clientY + 'px' }, 80)
})

// ── NAVBAR ──
window.addEventListener('scroll', () => document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50))
document.getElementById('hamburger').addEventListener('click', () => document.getElementById('navLinks').classList.toggle('open'))
document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open')))

// ── COUNTERS ──
let countersStarted = false
function animateCounters() {
    if (countersStarted) return
    countersStarted = true
    document.querySelectorAll('.counter').forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'))
        let current = 0
        const step = target / 60
        const timer = setInterval(() => {
            current += step
            if (current >= target) { counter.textContent = target + '+'; clearInterval(timer) }
            else counter.textContent = Math.floor(current)
        }, 30)
    })
}

// ── SCROLL REVEAL ──
const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            if (entry.target.classList.contains('stats-section')) animateCounters()
        }
    })
}, { threshold: 0.1 })
document.querySelectorAll('.reveal, .stats-section').forEach(el => observer.observe(el))

// ── GALLERY ──
let currentFilter = 'all'
let searchQuery = ''

async function loadGallery() {
    const grid = document.getElementById('galleryGrid')
    const noArtworks = document.getElementById('noArtworks')
    grid.innerHTML = '<div class="loading">Loading artworks...</div>'
    try {
        let url = '/artworks?'
        if (currentFilter !== 'all') url += `category=${currentFilter}&`
        if (searchQuery) url += `search=${searchQuery}`
        const res = await fetch(url)
        const result = await res.json()
        grid.innerHTML = ''
        if (!result.data || result.data.length === 0) {
            noArtworks.style.display = 'block'
            return
        }
        noArtworks.style.display = 'none'
        result.data.forEach((art, i) => {
            const card = document.createElement('div')
            card.className = 'gallery-card reveal'
            const imgHtml = art.imageUrl
                ? `<img src="${art.imageUrl}" alt="${art.title}" loading="lazy">`
                : `<div class="gallery-card-placeholder">🎨</div>`
            card.innerHTML = `
                ${imgHtml}
                <div class="gallery-card-body">
                    <h3>${art.title}</h3>
                    <p>${art.description}</p>
                    <span class="art-tag">${art.category}</span>
                </div>`
            grid.appendChild(card)
            setTimeout(() => { card.classList.add('visible'); observer.observe(card) }, i * 80)
        })
    } catch (err) {
        grid.innerHTML = '<div class="loading">Failed to load artworks. Make sure server is running!</div>'
    }
}

// ── FILTER ──
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        currentFilter = btn.getAttribute('data-filter')
        loadGallery()
    })
})

// ── SEARCH ──
let searchTimer
document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
        searchQuery = e.target.value.trim()
        loadGallery()
    }, 400)
})

loadGallery()

// ── TESTIMONIALS ──
async function loadTestimonials() {
    const grid = document.getElementById('testimonialsGrid')
    try {
        const res = await fetch('/testimonials')
        const result = await res.json()
        if (!result.data || result.data.length === 0) {
            grid.innerHTML = '<div class="loading">No reviews yet. Be the first!</div>'
            return
        }
        grid.innerHTML = ''
        result.data.forEach(t => {
            const card = document.createElement('div')
            card.className = 'testimonial-card reveal'
            const stars = '⭐'.repeat(t.rating)
            card.innerHTML = `
                <div class="testimonial-stars">${stars}</div>
                <p>"${t.review}"</p>
                <div class="testimonial-author">${t.name}</div>
                ${t.artType ? `<div class="testimonial-type">${t.artType}</div>` : ''}
            `
            grid.appendChild(card)
            observer.observe(card)
        })
    } catch (err) {
        grid.innerHTML = '<div class="loading">Could not load reviews.</div>'
    }
}

loadTestimonials()

// ── SUBMIT REVIEW ──
document.getElementById('submitReview').addEventListener('click', async () => {
    const name = document.getElementById('reviewName').value.trim()
    const review = document.getElementById('reviewText').value.trim()
    const rating = document.getElementById('reviewRating').value
    const artType = document.getElementById('reviewArtType').value.trim()
    const success = document.getElementById('reviewSuccess')
    if (!name || !review || !rating) { alert('Please fill name, review and rating!'); return }
    try {
        const res = await fetch('/testimonials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, review, rating: parseInt(rating), artType })
        })
        if (!res.ok) throw new Error('Failed')
        success.style.display = 'block'
        document.getElementById('reviewName').value = ''
        document.getElementById('reviewText').value = ''
        document.getElementById('reviewRating').value = ''
        document.getElementById('reviewArtType').value = ''
        setTimeout(() => success.style.display = 'none', 4000)
        loadTestimonials()
    } catch (err) { alert('Something went wrong!') }
})

// ── SCROLL TO CONTACT ──
function scrollToContact(type) {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => document.getElementById('typeInput').value = type, 800)
}

// ── CONTACT FORM ──
document.getElementById('submitBtn').addEventListener('click', async () => {
    const name = document.getElementById('nameInput').value.trim()
    const email = document.getElementById('emailInput').value.trim()
    const phone = document.getElementById('phoneInput').value.trim()
    const type = document.getElementById('typeInput').value
    const message = document.getElementById('messageInput').value.trim()
    const successMsg = document.getElementById('successMsg')
    const errorMsg = document.getElementById('errorMsg')
    successMsg.style.display = 'none'
    errorMsg.style.display = 'none'
    if (!name || !email || !type || !message) { errorMsg.style.display = 'block'; return }
    try {
        const res = await fetch('/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, type, message })
        })
        if (!res.ok) throw new Error('Failed')
        successMsg.style.display = 'block'
        document.getElementById('nameInput').value = ''
        document.getElementById('emailInput').value = ''
        document.getElementById('phoneInput').value = ''
        document.getElementById('typeInput').value = ''
        document.getElementById('messageInput').value = ''
        setTimeout(() => successMsg.style.display = 'none', 5000)
    } catch (err) { errorMsg.textContent = '❌ Something went wrong. Try again!'; errorMsg.style.display = 'block' }
})