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
//  YARDIMCI FONKSİYONLAR (Hataları önlemek için en üstte)
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
//  STATE (DURUM)
// ══════════════════════════════════════════
let currentUser = null;

// ══════════════════════════════════════════
//  AUTH OBSERVER
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

function loadApp() {
    window.showPage('app');
    const nameEl = document.getElementById('user-name-sidebar');
    const emailEl = document.getElementById('user-email-sidebar');
    if(nameEl) nameEl.textContent = currentUser.displayName || "Kullanıcı";
    if(emailEl) emailEl.textContent = currentUser.email;
    window.renderTasks();
    window.renderDashboard();
}

// ══════════════════════════════════════════
//  SAYFA YÖNETİMİ
// ══════════════════════════════════════════
window.showPage = (p) => {
    document.querySelectorAll('.page').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const page = document.getElementById('page-' + p);
    if (page) {
        page.classList.add('active');
        page.style.display = (p === 'login' || p === 'signup') ? 'flex' : 'block';
    }
};

window.switchView = (view, el) => {
    document.querySelectorAll('#view-dashboard, #view-tasks, #view-settings').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
    });

    const viewEl = document.getElementById('view-' + view);
    if (viewEl) {
        viewEl.classList.add('active');
        viewEl.style.display = 'block';
    }

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const titles = { dashboard: 'Dashboard', tasks: 'Tüm Görevler', settings: 'Ayarlar' };
    document.getElementById('top-bar-title').textContent = titles[view] || 'TaskFlow';

    if (view === 'tasks') window.renderTasks();
    if (view === 'dashboard') window.renderDashboard();
    
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
    }
};

// ══════════════════════════════════════════
//  GÖREV İŞLEMLERİ
// ══════════════════════════════════════════
window.openTaskModal = () => {
    const catSel = document.getElementById('task-category-input');
    const defaultCats = ['İş', 'Kişisel', 'Eğitim', 'Sağlık', 'Alışveriş'];
    if (catSel) {
        catSel.innerHTML = defaultCats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    document.getElementById('task-title-input').value = "";
    document.getElementById('task-desc-input').value = "";
    document.getElementById('task-modal').classList.add('open');
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('open');
};

window.saveTask = async () => {
    const title = v('task-title-input').trim();
    if (!title) { window.toast("Başlık boş olamaz!", "error"); return; }

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

window.renderDashboard = async () => {
    if (!currentUser) return;
    try {
        const q = query(collection(window.db, "tasks"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);
        
        let total = 0, completed = 0, pending = 0;
        snap.forEach(d => {
            total++;
            if (d.data().completed) completed++; else pending++;
        });

        const update = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
        update('stat-total', total);
        update('stat-done', completed);
        update('stat-pending', pending);
        update('tasks-badge', pending);
        
        const pct = document.getElementById('stat-done-pct');
        if (pct) pct.textContent = total > 0 ? `%${Math.round((completed/total)*100)} tamamlandı` : '%0';
    } catch (e) { console.error(e); }
};

window.toggleTask = async (id, currentStatus) => {
    await updateDoc(doc(window.db, "tasks", id), { completed: !currentStatus });
    window.renderTasks();
    window.renderDashboard();
};

window.deleteTask = async (id) => {
    if (confirm("Silmek istediğinize emin misiniz?")) {
        await deleteDoc(doc(window.db, "tasks", id));
        window.renderTasks();
        window.renderDashboard();
    }
};

// ══════════════════════════════════════════
//  AUTH İŞLEMLERİ
// ══════════════════════════════════════════
window.handleSignup = async () => {
    const name = v('signup-name'), email = v('signup-email'), pass = v('signup-pass');
    try {
        const res = await createUserWithEmailAndPassword(window.auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        window.toast("Hesap oluşturuldu!", "success");
    } catch (e) { window.toast(e.message, "error"); }
};

window.handleLogin = async () => {
    try {
        await signInWithEmailAndPassword(window.auth, v('login-email'), v('login-pass'));
        window.toast("Hoş geldiniz!", "success");
    } catch (e) { window.toast("Hata: " + e.message, "error"); }
};

window.confirmLogout = () => {
    if(confirm("Çıkış yapıyorsunuz?")) signOut(window.auth);
};

window.clearAllTasks = async () => {
    // Kullanıcıdan onay al
    if (!confirm("Tüm görevleriniz kalıcı olarak silinecektir. Bu işlemi geri alamazsınız. Emin misiniz?")) {
        return;
    }

    try {
        // Sadece mevcut kullanıcıya ait görevleri sorgula
        const q = query(collection(window.db, "tasks"), where("userId", "==", currentUser.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            window.toast("Silinecek görev bulunamadı.", "info");
            return;
        }

        // Her bir görevi tek tek sil
        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(window.db, "tasks", docSnap.id)));
        });

        // Tüm silme işlemlerinin bitmesini bekle
        await Promise.all(deletePromises);

        window.toast("Tüm görevler temizlendi!", "success");
        
        // Arayüzü güncelle
        window.renderTasks();
        window.renderDashboard();
    } catch (e) {
        console.error("Temizleme hatası:", e);
        window.toast("Hata oluştu: " + e.message, "error");
    }
};