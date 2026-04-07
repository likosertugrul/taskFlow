import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    deleteDoc, 
    updateDoc, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ══════════════════════════════════════════
//  STATE (DURUM)
// ══════════════════════════════════════════
let currentUser = null;
let editingTaskId = null;

// ══════════════════════════════════════════
//  AUTH OBSERVER (OTURUM TAKİBİ)
// ══════════════════════════════════════════
onAuthStateChanged(window.auth, (user) => {
    if (user) {
        currentUser = user;
        loadApp();
    } else {
        currentUser = null;
        window.showPage('landing');
    }
});

// ══════════════════════════════════════════
//  SAYFA VE GÖRÜNÜM YÖNETİMİ
// ══════════════════════════════════════════

// Ana sayfalar arası geçiş (Landing, App, Login vb.)
window.showPage = (p) => {
    document.querySelectorAll('.page').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const page = document.getElementById('page-' + p);
    if (page) {
        page.classList.add('active');
        // Flex gerektiren sayfalar için özel kontrol
        page.style.display = (p === 'login' || p === 'signup') ? 'flex' : 'block';
    }
};

// Uygulama içi görünümler arası geçiş (Dashboard, Tasks, Settings)
window.switchView = (view, el) => {
    // Görünümleri gizle
    document.querySelectorAll('#view-dashboard, #view-tasks, #view-settings').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });

    // Hedef görünümü göster
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) {
        viewEl.classList.add('active');
        viewEl.style.display = 'block';
    }

    // Sidebar menü aktiflik görseli
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    // Başlığı güncelle
    const titles = { dashboard: 'Dashboard', tasks: 'Tüm Görevler', settings: 'Ayarlar' };
    document.getElementById('top-bar-title').textContent = titles[view] || 'TaskFlow';

    // Verileri yenile
    if (view === 'tasks') window.renderTasks();
    if (view === 'dashboard') window.renderDashboard();
    
    // Mobil sidebar kapatma
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
};

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('open');
};

// ══════════════════════════════════════════
//  MODAL VE FORM İŞLEMLERİ
// ══════════════════════════════════════════
window.openTaskModal = (editId = null) => {
    editingTaskId = editId;
    const catSel = document.getElementById('task-category-input');
    const defaultCats = ['İş', 'Kişisel', 'Eğitim', 'Sağlık', 'Alışveriş'];
    
    // Kategorileri doldur
    if (catSel) {
        catSel.innerHTML = defaultCats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // Formu sıfırla
    document.getElementById('task-title-input').value = "";
    document.getElementById('task-desc-input').value = "";
    document.getElementById('task-due-input').value = "";

    document.getElementById('task-modal').classList.add('open');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('open');
};

// ══════════════════════════════════════════
//  FIREBASE AUTH (GİRİŞ/KAYIT)
// ══════════════════════════════════════════
window.handleSignup = async () => {
    const name = v('signup-name');
    const email = v('signup-email');
    const pass = v('signup-pass');

    try {
        const userCredential = await createUserWithEmailAndPassword(window.auth, email, pass);
        await updateProfile(userCredential.user, { displayName: name });
        window.toast("Hesap oluşturuldu!", "success");
    } catch (error) {
        window.toast(error.message, "error");
    }
};

window.handleLogin = async () => {
    const email = v('login-email');
    const pass = v('login-pass');
    try {
        await signInWithEmailAndPassword(window.auth, email, pass);
        window.toast("Hoş geldiniz!", "success");
    } catch (error) {
        window.toast("Hata: " + error.message, "error");
    }
};

window.confirmLogout = () => {
    if(confirm("Çıkış yapmak istediğinize emin misiniz?")) {
        signOut(window.auth);
    }
};

// ══════════════════════════════════════════
//  FIREBASE FIRESTORE (GÖREV YÖNETİMİ)
// ══════════════════════════════════════════
window.saveTask = async () => {
    const title = v('task-title-input').trim();
    if (!title) { alert("Başlık boş olamaz!"); return; }

    try {
        const taskData = {
            userId: currentUser.uid,
            title: title,
            desc: v('task-desc-input').trim(),
            priority: document.getElementById('task-priority-input').value,
            category: document.getElementById('task-category-input').value,
            due: v('task-due-input'),
            completed: false,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(window.db, "tasks"), taskData);
        window.closeModal('task-modal');
        window.toast("Görev eklendi!", "success");
        window.renderTasks();
        window.renderDashboard();
    } catch (e) {
        window.toast("Hata: " + e.message, "error");
    }
};

window.renderTasks = async () => {
    const list = document.getElementById('task-list');
    if (!list || !currentUser) return;

    try {
        // Not: Bu sorgu için Firebase Konsolunda INDEX oluşturulmuş olmalıdır.
        const q = query(
            collection(window.db, "tasks"), 
            where("userId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        let html = "";
        
        querySnapshot.forEach((docSnap) => {
            const t = docSnap.data();
            const id = docSnap.id;
            html += `
                <div class="task-item ${t.completed ? 'completed' : ''}">
                    <div class="task-checkbox ${t.completed ? 'done' : ''}" onclick="window.toggleTask('${id}', ${t.completed})">
                        ${t.completed ? '✓' : ''}
                    </div>
                    <div class="task-main">
                        <div class="task-title">${esc(t.title)}</div>
                        <div class="task-meta">
                            <span class="priority-badge priority-${t.priority}">⬤ ${cap(t.priority)}</span>
                            <span class="tag tag-category">${esc(t.category)}</span>
                            ${t.due ? `<span class="task-due">📅 ${t.due}</span>` : ''}
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="task-action-btn delete" onclick="window.deleteTask('${id}')">🗑</button>
                    </div>
                </div>`;
        });
        
        list.innerHTML = html || '<div class="empty-state">Henüz bir görev eklemediniz.</div>';
    } catch (e) {
        console.error("Render hatası:", e);
    }
};

window.toggleTask = async (id, currentStatus) => {
    const taskRef = doc(window.db, "tasks", id);
    await updateDoc(taskRef, { completed: !currentStatus });
    window.renderTasks();
    window.renderDashboard();
};

window.deleteTask = async (id) => {
    if (confirm("Bu görevi silmek istediğinize emin misiniz?")) {
        await deleteDoc(doc(window.db, "tasks", id));
        window.renderTasks();
        window.renderDashboard();
    }
};

// ══════════════════════════════════════════
//  YARDIMCI FONKSİYONLAR
// ══════════════════════════════════════════
function loadApp() {
    window.showPage('app');
    document.getElementById('user-name-sidebar').textContent = currentUser.displayName || "Kullanıcı";
    document.getElementById('user-email-sidebar').textContent = currentUser.email;
    window.renderTasks();
    window.renderDashboard();
}

window.renderDashboard = async () => {
    // Basit istatistik güncelleme
    const q = query(collection(window.db, "tasks"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);
    document.getElementById('stat-total').textContent = snap.size;
};

const v = (id) => document.getElementById(id)?.value || '';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

window.toast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> <span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => t.remove(), 300);
    }, 3000);
};