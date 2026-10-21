/* =========================================================
   DAGI ELECTRONICS SHOP - admin.js (owner dashboard)
   Paste the SAME two values you used in script.js.
   ========================================================= */
const CONFIG = {
    supabaseUrl: "https://ifabdvzglzgcvzqwfeey.supabase.co",   // example: https://abcdxyz.supabase.co
    supabaseKey: "sb_publishable_3rbUjyRSOZeEZ082sy5_gw_nzBb9GNW "    // the "anon public" key
};

const BUCKET = "product-images";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/* ---------- Elements ---------- */
const $ = function (id) { return document.getElementById(id); };

const notice = $("notice");
const loginPanel = $("login-panel");
const shopPanel = $("shop-panel");
const dashboard = $("dashboard");
const logoutBtn = $("logout-btn");
const productForm = $("product-form");
const formTitle = $("form-title");
const saveBtn = $("save-btn");
const cancelBtn = $("cancel-btn");
const imageHint = $("image-hint");
const adminList = $("admin-list");

let db = null;
let myShop = null;
let views = {};
let products = [];
let editingId = null;
let editingImage = "";

/* ---------- Helpers ---------- */
function esc(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function showNotice(message, isError) {
    notice.textContent = message;
    notice.className = "notice" + (isError ? " error" : "");
    notice.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideNotice() {
    notice.hidden = true;
}

function showLogin() {
    loginPanel.hidden = false;
    shopPanel.hidden = true;
    dashboard.hidden = true;
    logoutBtn.hidden = true;
}

function showShopPanel() {
    loginPanel.hidden = true;
    shopPanel.hidden = false;
    dashboard.hidden = true;
    logoutBtn.hidden = false;
}

function showDashboard() {
    loginPanel.hidden = true;
    shopPanel.hidden = true;
    dashboard.hidden = false;
    logoutBtn.hidden = false;
}

/* ---------- Start ---------- */
async function start() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
        showNotice("Add supabaseUrl and supabaseKey at the top of admin.js.", true);
        return;
    }

    /* Remove spaces and a trailing slash that are easy to paste by mistake */
    CONFIG.supabaseUrl = CONFIG.supabaseUrl.trim().replace(/\/+$/, "");
    CONFIG.supabaseKey = CONFIG.supabaseKey.trim();

    db = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

    const result = await db.auth.getSession();
    if (result.data.session) {
        await enterDashboard();
    } else {
        showLogin();
    }
}

/* Only accounts listed in shop_admins may use the dashboard */
async function enterDashboard() {
    const user = (await db.auth.getUser()).data.user;
    if (!user) { showLogin(); return; }

    const check = await db.from("shop_members").select("shop_id, shops(*)").eq("user_id", user.id);

    if (check.error) {
        await db.auth.signOut();
        showLogin();
        showNotice("Could not check your account: " + check.error.message, true);
        return;
    }

    if (!check.data || check.data.length === 0 || !check.data[0].shops) {
        showShopPanel();
        showNotice("Welcome! Open your shop to get started.", false);
        return;
    }

    myShop = check.data[0].shops;

    const statusText = {
        pending: "Pending approval. Customers cannot see your products yet.",
        approved: "Approved. Customers can see your products.",
        hidden: "Hidden by the platform admin."
    };
    $("shop-status").textContent = "Shop status: " + (statusText[myShop.status] || myShop.status);

    hideNotice();
    showDashboard();
    await loadSettings();
    await loadProducts();
    await loadSupportLink();
}

/* "Need help?" link goes to the platform's WhatsApp number */
async function loadSupportLink() {
    const result = await db.from("shop_settings").select("whatsapp").eq("id", 1);
    if (result.error || !result.data || !result.data[0] || !result.data[0].whatsapp) return;

    const digits = String(result.data[0].whatsapp).replace(/\D/g, "");
    if (!digits) return;

    const link = $("support-link");
    link.href = "https://wa.me/" + digits + "?text=" +
        encodeURIComponent("Hello, I need help with my shop: " + (myShop ? myShop.name : ""));
    $("support-line").hidden = false;
}

/* ---------- Shop settings ---------- */
async function loadSettings() {
    const s = myShop;
    if (!s) return;

    $("s-name").value = s.name || "";
    $("s-whatsapp").value = s.whatsapp || "";
    $("s-telegram").value = s.telegram || "";
    $("s-email").value = s.email || "";
    $("s-address").value = s.address || "";
    $("s-hours").value = s.hours || "";
}

/* Turn 0911223344 or +251 911 223 344 into 251911223344 */
function cleanPhone(value) {
    let digits = value.replace(/\D/g, "");
    if (digits.length === 10 && digits.charAt(0) === "0") {
        digits = "251" + digits.slice(1);
    }
    return digits;
}

$("settings-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const button = $("settings-btn");
    button.disabled = true;

    const row = {
        name: $("s-name").value.trim(),
        whatsapp: cleanPhone($("s-whatsapp").value),
        telegram: $("s-telegram").value.trim().replace(/^@/, ""),
        email: $("s-email").value.trim(),
        address: $("s-address").value.trim(),
        hours: $("s-hours").value.trim()
    };

    const result = await db.from("shops").update(row).eq("id", myShop.id);
    button.disabled = false;

    if (result.error) {
        showNotice("Could not save settings: " + result.error.message, true);
        return;
    }

    Object.assign(myShop, row);
    $("s-whatsapp").value = row.whatsapp;
    showNotice("Settings saved.", false);
});

/* ---------- Login / logout ---------- */
$("login-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!db) return;

    const result = await db.auth.signInWithPassword({
        email: $("email").value.trim(),
        password: $("password").value
    });

    if (result.error) {
        showNotice("Login failed: " + result.error.message, true);
        return;
    }

    $("password").value = "";
    await enterDashboard();
});

logoutBtn.addEventListener("click", async function () {
    await db.auth.signOut();
    myShop = null;
    products = [];
    resetForm();
    showLogin();
    showNotice("You are logged out.", false);
});

/* ---------- Product list ---------- */
async function loadProducts() {
    const result = await db.from("products").select("*")
        .eq("shop_id", myShop.id)
        .order("id", { ascending: false });

    if (result.error) {
        showNotice("Could not load products: " + result.error.message, true);
        return;
    }

    products = result.data;

    /* View counts (a missing table just means no counts yet) */
    views = {};
    const stats = await db.from("product_stats").select("product_id, views");
    if (!stats.error && stats.data) {
        stats.data.forEach(function (s) { views[s.product_id] = s.views; });
    }

    renderList();
}

function renderList() {
    if (products.length === 0) {
        adminList.innerHTML = '<li class="hint">No products yet. Add your first one above.</li>';
        return;
    }

    adminList.innerHTML = products.map(function (p) {
        const picture = p.image_url
            ? '<img src="' + esc(p.image_url) + '" alt="">'
            : '<img alt="">';

        return '' +
            '<li class="admin-item">' + picture +
            '  <div>' +
            '    <strong>' + esc(p.name) + '</strong>' +
            '    <span class="meta">' + esc(p.category) + ' | ' +
            Number(p.price).toLocaleString("en-US") + ' ETB | ' +
            (p.in_stock ? "In stock" : "Out of stock") +
            ' | Views: ' + (views[p.id] || 0) + '</span>' +
            '  </div>' +
            '  <div class="admin-actions">' +
            '    <button type="button" class="btn-small" data-edit="' + p.id + '">Edit</button>' +
            '    <button type="button" class="btn-small btn-danger" data-delete="' + p.id + '">Delete</button>' +
            '  </div>' +
            '</li>';
    }).join("");
}

adminList.addEventListener("click", function (event) {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) startEdit(Number(editButton.dataset.edit));
    if (deleteButton) removeProduct(Number(deleteButton.dataset.delete));
});

/* ---------- Form ---------- */
function resetForm() {
    productForm.reset();
    $("p-stock").checked = true;
    editingId = null;
    editingImage = "";
    formTitle.textContent = "Add a product";
    saveBtn.textContent = "Save product";
    cancelBtn.hidden = true;
    imageHint.textContent = "Choose a picture (max 2 MB).";
}

function startEdit(id) {
    const p = products.find(function (item) { return item.id === id; });
    if (!p) return;

    editingId = id;
    editingImage = p.image_url || "";

    $("p-name").value = p.name;
    $("p-category").value = p.category;
    $("p-price").value = p.price;
    $("p-description").value = p.description || "";
    $("p-specs").value = (p.specs || []).join("\n");
    $("p-stock").checked = p.in_stock;
    $("p-featured").checked = p.featured;
    $("p-image").value = "";

    formTitle.textContent = "Edit product";
    saveBtn.textContent = "Save changes";
    cancelBtn.hidden = false;
    imageHint.textContent = editingImage
        ? "Keep the current picture, or choose a new one."
        : "Choose a picture (max 2 MB).";

    hideNotice();
    formTitle.scrollIntoView({ behavior: "smooth" });
}

cancelBtn.addEventListener("click", resetForm);

async function uploadImage(file) {
    if (!file.type.startsWith("image/")) throw new Error("The file must be a picture.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("The picture is bigger than 2 MB.");

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const path = Date.now() + "-" + safeName;

    const upload = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (upload.error) throw new Error("Picture upload failed: " + upload.error.message);

    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

productForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = "Saving...";

    try {
        let imageUrl = editingImage;
        const file = $("p-image").files[0];
        if (file) imageUrl = await uploadImage(file);

        const row = {
            name: $("p-name").value.trim(),
            category: $("p-category").value.trim(),
            price: Number($("p-price").value),
            description: $("p-description").value.trim(),
            specs: $("p-specs").value.split("\n")
                .map(function (line) { return line.trim(); })
                .filter(Boolean),
            image_url: imageUrl,
            shop_id: myShop.id,
            in_stock: $("p-stock").checked,
            featured: $("p-featured").checked
        };

        const result = editingId
            ? await db.from("products").update(row).eq("id", editingId)
            : await db.from("products").insert(row);

        if (result.error) throw new Error(result.error.message);

        const wasEdit = Boolean(editingId);
        resetForm();
        await loadProducts();
        showNotice(wasEdit ? "Product updated." : "Product added.", false);
    } catch (error) {
        showNotice(error.message, true);
        saveBtn.textContent = label;
    } finally {
        saveBtn.disabled = false;
    }
});

/* ---------- Delete ---------- */
async function removeProduct(id) {
    const p = products.find(function (item) { return item.id === id; });
    if (!p) return;

    if (!confirm('Delete "' + p.name + '"? This cannot be undone.')) return;

    const result = await db.from("products").delete().eq("id", id);
    if (result.error) {
        showNotice("Could not delete: " + result.error.message, true);
        return;
    }

    if (editingId === id) resetForm();
    await loadProducts();
    showNotice("Product deleted.", false);
}

/* ---------- Seller sign-up ---------- */
function showSignupForm(show) {
    $("login-form").hidden = show;
    $("signup-form").hidden = !show;
    $("switch-to-signup-text").hidden = show;
    $("switch-to-login-text").hidden = !show;
    $("login-title").textContent = show ? "Create seller account" : "Seller login";
}

$("show-signup").addEventListener("click", function () { showSignupForm(true); });
$("show-login").addEventListener("click", function () { showSignupForm(false); });

$("signup-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!db) return;

    const result = await db.auth.signUp({
        email: $("su-email").value.trim(),
        password: $("su-password").value
    });

    if (result.error) {
        showNotice("Could not create account: " + result.error.message, true);
        return;
    }

    $("su-password").value = "";

    /* Logged in right away (email confirmation is off) */
    if (result.data.session) {
        await enterDashboard();
        return;
    }

    showSignupForm(false);
    showNotice("Account created. Open the confirmation link we sent to your email, then log in here.", false);
});

/* First login with no shop: request one */
$("shop-register-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const result = await db.rpc("register_shop", {
        p_name: $("r-name").value.trim(),
        p_whatsapp: cleanPhone($("r-whatsapp").value),
        p_telegram: $("r-telegram").value.trim().replace(/^@/, "")
    });

    if (result.error) {
        showNotice("Could not create shop: " + result.error.message, true);
        return;
    }
    if (result.data !== "ok") {
        showNotice(result.data, true);
        return;
    }

    await enterDashboard();
    showNotice("Shop sent for approval. You can add products now. Customers see them after approval.", false);
});

start();
