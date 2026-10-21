/* =========================================================
   DAGI ELECTRONICS SHOP - script.js
   1) CONFIG: change your contact details here
   2) PRODUCTS: your product list (later this comes from Supabase)
   3) Code below draws the products and handles search/filter/sort
   ========================================================= */

/* ---------- 1) CONFIG ---------- */
const CONFIG = {
    // WhatsApp number: country code + number, digits only, no + or spaces.
    // Ethiopia example: 251911223344  (replace with your real number)
    whatsappNumber: "251900000000",
    shopName: "Dagi Electronics Shop",
    currency: "ETB",

    // Fallbacks. Phase 4 loads the real values from Supabase (shop_settings).
    email: "dagielectronics@example.com",
    telegram: "",
    address: "",
    hours: "",

    // Supabase: Project Settings > API. Leave empty to use the local list below.
    supabaseUrl: "",      // example: https://abcdxyz.supabase.co
    supabaseKey: ""       // the "anon public" key (never the service_role key)
};

/* ---------- 2) PRODUCTS ---------- */
/* Backup list: used when Supabase is not set up or cannot be reached */
const LOCAL_PRODUCTS = [
    {
        id: 1,
        name: "Laptop",
        category: "Laptops",
        price: 25000,
        image: "pictures/laptop.png",
        description: "A laptop for programming, education, office work, and entertainment.",
        specs: ["Add RAM here", "Add storage here", "Add processor here"],
        inStock: true,
        featured: true
    },
    {
        id: 2,
        name: "Samsung Galaxy A15",
        category: "Smartphones",
        price: 18500,
        image: "pictures/phone.png",
        description: "A smartphone for communication, studying, photography, and entertainment.",
        specs: ["Add RAM here", "Add storage here", "Add camera here"],
        inStock: true,
        featured: false
    },
    {
        id: 3,
        name: "Desktop Computer",
        category: "Desktop Computers",
        price: 35000,
        image: "pictures/computer.png",
        description: "A desktop computer for software development, business, education, and office work.",
        specs: ["Add RAM here", "Add storage here", "Monitor included"],
        inStock: true,
        featured: false
    }
];

let PRODUCTS = LOCAL_PRODUCTS;

/* Load products from Supabase (REST API, no library needed) */
async function loadProducts() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return;

    try {
        const response = await fetch(
            CONFIG.supabaseUrl + "/rest/v1/products?select=*,shops(name,whatsapp)&order=id.asc",
            {
                headers: {
                    apikey: CONFIG.supabaseKey,
                    Authorization: "Bearer " + CONFIG.supabaseKey
                }
            }
        );
        if (!response.ok) throw new Error("Supabase error " + response.status);

        const rows = await response.json();
        if (rows.length === 0) return;

        PRODUCTS = rows.map(function (r) {
            return {
                id: r.id,
                name: r.name,
                category: r.category,
                price: Number(r.price),
                image: r.image_url || "",
                description: r.description || "",
                specs: r.specs || [],
                inStock: r.in_stock,
                featured: r.featured,
                shopId: r.shop_id,
                shopName: r.shops ? r.shops.name : "",
                shopWhatsapp: (r.shops && r.shops.whatsapp)
                    ? String(r.shops.whatsapp).replace(/\D/g, "")
                    : ""
            };
        });
    } catch (error) {
        console.error("Could not load products, using local list.", error);
    }
}

/* Load shop settings (WhatsApp, email, hours...) from Supabase */
async function loadSettings() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return;

    try {
        const response = await fetch(
            CONFIG.supabaseUrl + "/rest/v1/shop_settings?id=eq.1&select=*",
            {
                headers: {
                    apikey: CONFIG.supabaseKey,
                    Authorization: "Bearer " + CONFIG.supabaseKey
                }
            }
        );
        if (!response.ok) throw new Error("Supabase error " + response.status);

        const rows = await response.json();
        if (rows.length === 0) return;

        const s = rows[0];
        if (s.shop_name) CONFIG.shopName = s.shop_name;
        if (s.whatsapp) CONFIG.whatsappNumber = String(s.whatsapp).replace(/\D/g, "");
        if (s.email) CONFIG.email = s.email;
        if (s.telegram) CONFIG.telegram = s.telegram;
        if (s.address) CONFIG.address = s.address;
        if (s.hours) CONFIG.hours = s.hours;
    } catch (error) {
        console.error("Could not load settings, using defaults.", error);
    }
}

/* ---------- 3) APP CODE ---------- */
const state = {
    category: "All",
    search: "",
    sort: "default"
};

const grid = document.getElementById("product-grid");
const chipsBox = document.getElementById("category-chips");
const countBox = document.getElementById("result-count");
const emptyBox = document.getElementById("empty");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");

/* Escape text so product data can never break the page */
function esc(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatPrice(amount) {
    return amount.toLocaleString("en-US") + " " + CONFIG.currency;
}

function whatsappLink(message, number) {
    return "https://wa.me/" + (number || CONFIG.whatsappNumber) +
        "?text=" + encodeURIComponent(message);
}

function productMessage(p) {
    return "Hello " + (p.shopName || CONFIG.shopName) + ", I am interested in the " +
        p.name + " (" + formatPrice(p.price) + "). Is it available?";
}

/* Category buttons are built from the product list automatically */
function renderChips() {
    const categories = ["All"].concat(
        Array.from(new Set(PRODUCTS.map(function (p) { return p.category; })))
    );

    chipsBox.innerHTML = categories.map(function (name) {
        return '<button type="button" class="chip" data-category="' + esc(name) +
            '" aria-pressed="' + (name === state.category) + '">' + esc(name) + "</button>";
    }).join("");
}

function getVisibleProducts() {
    const term = state.search.trim().toLowerCase();

    let list = PRODUCTS.filter(function (p) {
        const inCategory = state.category === "All" || p.category === state.category;
        const text = (p.name + " " + p.category + " " + p.description).toLowerCase();
        return inCategory && (term === "" || text.includes(term));
    });

    if (state.sort === "low") {
        list = list.slice().sort(function (a, b) { return a.price - b.price; });
    } else if (state.sort === "high") {
        list = list.slice().sort(function (a, b) { return b.price - a.price; });
    } else if (state.sort === "new") {
        /* Newer products have a bigger id */
        list = list.slice().sort(function (a, b) { return b.id - a.id; });
    }

    return list;
}

function productCard(p) {
    const badge = p.inStock
        ? (p.featured ? '<span class="badge">Popular</span>' : "")
        : '<span class="badge out">Out of stock</span>';

    const specs = (p.specs && p.specs.length)
        ? '<ul class="specs">' + p.specs.map(function (s) {
            return "<li>" + esc(s) + "</li>";
        }).join("") + "</ul>"
        : "";

    return '' +
        '<article class="product-card">' +
        '  <div class="product-image">' + badge +
        '    <img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
        '  </div>' +
        '  <div class="product-info">' +
        '    <h3>' + esc(p.name) + '</h3>' +
        '    <p class="category-label">' + esc(p.category) +
        (p.shopName ? ' | Sold by ' + esc(p.shopName) : '') + '</p>' +
        '    <p>' + esc(p.description) + '</p>' + specs +
        '    <p class="price">' + formatPrice(p.price) + '</p>' +
        '    <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' +
        whatsappLink(productMessage(p), p.shopWhatsapp) + '">Ask on WhatsApp</a>' +
        '    <button type="button" class="btn btn-secondary" data-details="' + p.id +
        '">View details</button>' +
        '  </div>' +
        '</article>';
}

function renderProducts() {
    const list = getVisibleProducts();

    grid.innerHTML = list.map(productCard).join("");
    emptyBox.hidden = list.length > 0;
    countBox.textContent = list.length + (list.length === 1 ? " product" : " products");

    /* If a picture is missing, show a neutral box instead of a broken icon */
    grid.querySelectorAll("img").forEach(function (img) {
        img.addEventListener("error", function () {
            img.style.visibility = "hidden";
        });
    });
}

/* ---------- Anonymous counters (no names, no cookies) ---------- */
const viewedProducts = {};

function callRpc(name, body) {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return;

    fetch(CONFIG.supabaseUrl + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: {
            apikey: CONFIG.supabaseKey,
            Authorization: "Bearer " + CONFIG.supabaseKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body || {})
    }).catch(function () { /* counting must never break the shop */ });
}

/* Count one visit per browser session */
function countVisit() {
    try {
        if (sessionStorage.getItem("dagi_visit")) return;
        sessionStorage.setItem("dagi_visit", "1");
    } catch (error) {
        return;
    }
    callRpc("count_visit");
}

/* ---------- Product details window ---------- */
const dialog = document.getElementById("detail-dialog");
const dialogBody = document.getElementById("detail-body");

function openDetails(id) {
    const p = PRODUCTS.find(function (item) { return item.id === id; });
    if (!p) return;

    const specs = (p.specs && p.specs.length)
        ? '<h4>Specs</h4><ul class="specs">' + p.specs.map(function (s) {
            return "<li>" + esc(s) + "</li>";
        }).join("") + "</ul>"
        : "";

    const canReport = Boolean(p.shopId && CONFIG.supabaseUrl && CONFIG.supabaseKey);

    dialogBody.innerHTML = '' +
        '<div class="detail-image"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '"></div>' +
        '<h2>' + esc(p.name) + '</h2>' +
        '<p class="category-label">' + esc(p.category) +
        (p.shopName ? ' | Sold by ' + esc(p.shopName) : '') + '</p>' +
        '<p class="price">' + formatPrice(p.price) + '</p>' +
        '<p>' + (p.inStock ? "In stock" : "Out of stock") + '</p>' +
        '<p>' + esc(p.description) + '</p>' + specs +
        '<div class="detail-actions">' +
        '  <a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' +
        whatsappLink(productMessage(p), p.shopWhatsapp) + '">Ask on WhatsApp</a>' +
        '  <a class="btn btn-secondary" href="mailto:' + esc(CONFIG.email) + '?subject=' +
        encodeURIComponent(p.name + " inquiry") + '">Ask by email</a>' +
        (canReport
            ? '  <button type="button" class="btn-link" data-report-open>Report this shop</button>'
            : '') +
        '</div>' +
        '<form class="report-form" id="report-form" data-product="' + p.id + '" hidden>' +
        '  <label for="report-reason">What is the problem?</label>' +
        '  <select id="report-reason">' +
        '    <option>Wrong price</option>' +
        '    <option>Product not available</option>' +
        '    <option>Fake or scam</option>' +
        '    <option>Bad behavior</option>' +
        '    <option>Other</option>' +
        '  </select>' +
        '  <label for="report-details">Details (optional)</label>' +
        '  <textarea id="report-details" rows="3" maxlength="500"></textarea>' +
        '  <button type="submit" class="btn btn-secondary">Send report</button>' +
        '  <p class="hint" id="report-status" role="status"></p>' +
        '</form>';

    const img = dialogBody.querySelector("img");
    img.addEventListener("error", function () { img.style.visibility = "hidden"; });

    dialog.showModal();

    if (p.shopId && !viewedProducts[p.id]) {
        viewedProducts[p.id] = true;
        callRpc("count_product_view", { p_id: p.id });
    }
}

async function sendReport(p, reason, details) {
    const response = await fetch(CONFIG.supabaseUrl + "/rest/v1/reports", {
        method: "POST",
        headers: {
            apikey: CONFIG.supabaseKey,
            Authorization: "Bearer " + CONFIG.supabaseKey,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        },
        body: JSON.stringify({
            shop_id: p.shopId,
            product_id: p.id,
            reason: reason,
            details: details || null
        })
    });
    return response.ok;
}

dialogBody.addEventListener("click", function (event) {
    if (event.target.closest("[data-report-open]")) {
        document.getElementById("report-form").hidden = false;
    }
});

dialogBody.addEventListener("submit", async function (event) {
    event.preventDefault();

    const form = event.target;
    const p = PRODUCTS.find(function (item) { return item.id === Number(form.dataset.product); });
    const status = document.getElementById("report-status");
    if (!p) return;

    status.textContent = "Sending...";

    try {
        const ok = await sendReport(
            p,
            document.getElementById("report-reason").value,
            document.getElementById("report-details").value.trim()
        );
        status.textContent = ok
            ? "Thank you. Your report was sent."
            : "Could not send the report. Please try again.";
        if (ok) form.querySelector("button[type=submit]").disabled = true;
    } catch (error) {
        status.textContent = "No connection. Please try again.";
    }
});

document.getElementById("detail-close").addEventListener("click", function () {
    dialog.close();
});

/* Tap outside the window to close it */
dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
});

/* ---------- Events ---------- */
grid.addEventListener("click", function (event) {
    const button = event.target.closest("[data-details]");
    if (button) openDetails(Number(button.dataset.details));
});

chipsBox.addEventListener("click", function (event) {
    const button = event.target.closest(".chip");
    if (!button) return;

    state.category = button.dataset.category;
    renderChips();
    renderProducts();
});

searchInput.addEventListener("input", function () {
    state.search = searchInput.value;
    renderProducts();
});

sortSelect.addEventListener("change", function () {
    state.sort = sortSelect.value;
    renderProducts();
});

/* Fill the footer and brand from settings */
function applySettings() {
    document.getElementById("footer-whatsapp").href =
        whatsappLink("Hello " + CONFIG.shopName + ", I have a question.");

    const email = document.getElementById("contact-email");
    email.href = "mailto:" + CONFIG.email;
    email.textContent = CONFIG.email;

    const hours = document.getElementById("contact-hours");
    hours.textContent = CONFIG.hours;
    hours.parentElement.hidden = !CONFIG.hours;

    const address = document.getElementById("contact-address");
    address.textContent = CONFIG.address;
    address.parentElement.hidden = !CONFIG.address;

    const telegram = document.getElementById("footer-telegram");
    if (CONFIG.telegram) {
        telegram.href = "https://t.me/" + encodeURIComponent(CONFIG.telegram.replace(/^@/, ""));
        telegram.hidden = false;
    }
}

/* ---------- Start ---------- */
Promise.all([loadSettings(), loadProducts()]).then(function () {
    applySettings();
    renderChips();
    renderProducts();
    countVisit();
});
