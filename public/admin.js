
async function loadStats() {
    try {
        const res = await fetch('/admin/stats')
        const result = await res.json()
        if (result.success) {
            document.getElementById('statArtworks').textContent = result.data.artworks
            document.getElementById('statCommissions').textContent = result.data.commissions
            document.getElementById('statPending').textContent = result.data.pending
            document.getElementById('statReviews').textContent = result.data.testimonials
        }
    } catch (err) { console.log('Stats error:', err) }
}

// Load artworks in admin
async function loadAdminArtworks() {
    const container = document.getElementById('adminArtworks')
    try {
        const res = await fetch('/artworks')
        const result = await res.json()
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p class="empty-msg">No artworks yet. Upload your first one!</p>'
            return
        }
        container.innerHTML = ''
        result.data.forEach(art => {
            const card = document.createElement('div')
            card.className = 'admin-art-card'
            const imgHtml = art.imageUrl ? `<img src="${art.imageUrl}" alt="${art.title}">` : '<div style="height:140px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:36px">🎨</div>'
            card.innerHTML = `
                ${imgHtml}
                <div class="admin-art-info">
                    <h4>${art.title}</h4>
                    <p>${art.category}</p>
                    <button class="btn-delete" onclick="deleteArtwork('${art._id}')">🗑 Delete</button>
                </div>`
            container.appendChild(card)
        })
    } catch (err) { container.innerHTML = '<p class="empty-msg">Failed to load artworks.</p>' }
}

// Delete artwork
async function deleteArtwork(id) {
    if (!confirm('Delete this artwork?')) return
    try {
        const res = await fetch(`/artworks/${id}`, { method: 'DELETE' })
        if (res.ok) { loadAdminArtworks(); loadStats() }
    } catch (err) { alert('Delete failed!') }
}

// Upload artwork
document.getElementById('artImage').addEventListener('change', e => {
    const file = e.target.files[0]
    document.getElementById('fileName').textContent = file ? `Selected: ${file.name}` : ''
})

document.getElementById('uploadBtn').addEventListener('click', async () => {
    const title = document.getElementById('artTitle').value.trim()
    const category = document.getElementById('artCategory').value
    const desc = document.getElementById('artDesc').value.trim()
    const image = document.getElementById('artImage').files[0]
    const featured = document.getElementById('artFeatured').checked
    const successEl = document.getElementById('uploadSuccess')
    const errorEl = document.getElementById('uploadError')
    successEl.style.display = 'none'
    errorEl.style.display = 'none'
    if (!title || !category || !desc || !image) {
        errorEl.textContent = '❌ Please fill all fields and select an image!'
        errorEl.style.display = 'block'
        return
    }
    const formData = new FormData()
    formData.append('title', title)
    formData.append('category', category)
    formData.append('description', desc)
    formData.append('image', image)
    formData.append('featured', featured)
    try {
        document.getElementById('uploadBtn').textContent = 'Uploading...'
        const res = await fetch('/artworks', { method: 'POST', body: formData })
        const result = await res.json()
        if (!res.ok) throw new Error(result.message)
        successEl.style.display = 'block'
        document.getElementById('artTitle').value = ''
        document.getElementById('artCategory').value = ''
        document.getElementById('artDesc').value = ''
        document.getElementById('artImage').value = ''
        document.getElementById('artFeatured').checked = false
        document.getElementById('fileName').textContent = ''
        loadAdminArtworks()
        loadStats()
    } catch (err) {
        errorEl.textContent = '❌ ' + err.message
        errorEl.style.display = 'block'
    } finally {
        document.getElementById('uploadBtn').textContent = 'Upload Artwork'
    }
})

// Load commissions
async function loadCommissions() {
    const container = document.getElementById('adminCommissions')
    try {
        const res = await fetch('/commissions')
        const result = await res.json()
        if (!result.data || result.data.length === 0) {
            container.innerHTML = '<p class="empty-msg">No commission requests yet.</p>'
            return
        }
        container.innerHTML = ''
        result.data.forEach(c => {
            const item = document.createElement('div')
            item.className = `commission-item status-${c.status}`
            const date = new Date(c.createdAt).toLocaleDateString('en-IN')
            item.innerHTML = `
                <div class="commission-details">
                    <h4>${c.name} — ${c.type}</h4>
                    <p>✉️ ${c.email} ${c.phone ? '| 📞 ' + c.phone : ''}</p>
                    <p style="margin-top:6px;font-style:italic;color:#666">"${c.message}"</p>
                    <p class="commission-meta">📅 ${date}</p>
                </div>
                <select class="status-select" onchange="updateStatus('${c._id}', this.value)">
                    <option value="pending" ${c.status==='pending'?'selected':''}>⏳ Pending</option>
                    <option value="confirmed" ${c.status==='confirmed'?'selected':''}>✅ Confirmed</option>
                    <option value="completed" ${c.status==='completed'?'selected':''}>🎨 Completed</option>
                </select>`
            container.appendChild(item)
        })
    } catch (err) { container.innerHTML = '<p class="empty-msg">Failed to load commissions.</p>' }
}

async function updateStatus(id, status) {
    try {
        await fetch(`/commissions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        })
        loadCommissions()
        loadStats()
    } catch (err) { alert('Update failed!') }
}

loadStats()
loadAdminArtworks()
loadCommissions()