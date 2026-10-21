/* =========================================================
   DAGI ELECTRONICS SHOP - reports.js (platform admin only)
   Paste the SAME two values you used in script.js.
   ========================================================= */
const CONFIG = {
    supabaseUrl: "",   // example: https://abcdxyz.supabase.co
    supabaseKey: ""    // the "anon public" key
};

const $ = function (id) { return document.getElementById(id); };

const notice = $("notice");
const loginPanel = $("login-panel");
const dashboard = $("dashboard");
const logoutBtn = $("logout-btn");
const list = $("report-list");

let db = null;
let reports = [];

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

function hideNotice() { notice.hidden = true; }

function showLogin() {
    loginPanel.hidden = false;
    dashboard.hidden = true;
    logoutBtn.hidden = true;
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    logoutBtn.hidden = false;
}

async function start() {
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
        showNotice("Add supabaseUrl and supabaseKey at the top of reports.js.", true);
        return;
    }

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

async function enterDashboard() {
    const user = (await db.auth.getUser()).data.user;
    if (!user) { showLogin(); return; }

    const check = await db.from("platform_admins").select("user_id").eq("user_id", user.id);

    if (check.error || !check.data || check.data.length === 0) {
        await db.auth.signOut();
        showLogin();
        showNotice("This account is not a platform admin.", true);
        return;
    }

    hideNotice();
    showDashboard();
    await loadReports();
    await loadStats();
}

/* ---------- Stats ---------- */
async function loadStats() {
    const days = await db.from("daily_stats").select("*")
        .order("day", { ascending: false }).limit(14);
    const top = await db.from("product_stats")
        .select("views, products(name, shops(name))")
        .order("views", { ascending: false }).limit(10);

    if (days.error || top.error) {
        $("stats-summary").textContent =
            "Stats are not ready. Run supabase-phase10.sql in Supabase first.";
        return;
    }

    const total = days.data.reduce(function (sum, d) { return sum + d.visits; }, 0);
    $("stats-summary").textContent = total + " visits in the last " + days.data.length +
        " days with visits (one per browser session).";

    $("stats-days").innerHTML = days.data.length === 0
        ? '<li class="hint">No visits counted yet.</li>'
        : days.data.map(function (d) {
            return '<li class="admin-item shop-item"><span><strong>' +
                new Date(d.day).toLocaleDateString("en-GB") + '</strong> ' +
                d.visits + ' visits</span></li>';
        }).join("");

    $("stats-products").innerHTML = top.data.length === 0
        ? '<li class="hint">No product views counted yet.</li>'
        : top.data.map(function (s) {
            const name = s.products ? s.products.name : "(deleted)";
            const shop = s.products && s.products.shops ? s.products.shops.name : "";
            return '<li class="admin-item shop-item"><span><strong>' + esc(name) +
                '</strong> ' + s.views + ' views' +
                (shop ? ' <span class="meta">' + esc(shop) + '</span>' : '') +
                '</span></li>';
        }).join("");
}

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
    reports = [];
    showLogin();
    showNotice("You are logged out.", false);
});

/* ---------- Reports ---------- */
async function loadReports() {
    const result = await db
        .from("reports")
        .select("*, shops(name, status), products(name)")
        .order("resolved", { ascending: true })
        .order("id", { ascending: false });

    if (result.error) {
        showNotice("Could not load reports: " + result.error.message, true);
        return;
    }

    reports = result.data;
    render();
}

function render() {
    const open = reports.filter(function (r) { return !r.resolved; }).length;
    $("summary").textContent = reports.length + (reports.length === 1 ? " report" : " reports") +
        ", " + open + " not resolved";

    if (reports.length === 0) {
        list.innerHTML = '<li class="hint">No reports. Good news.</li>';
        return;
    }

    list.innerHTML = reports.map(function (r) {
        const shop = r.shops ? r.shops.name : "(shop deleted)";
        const product = r.products ? r.products.name : "(product deleted)";
        const when = new Date(r.created_at).toLocaleDateString("en-GB");

        return '' +
            '<li class="admin-item shop-item">' +
            '  <div class="shop-main">' +
            '    <strong>' + esc(r.reason) + (r.resolved ? " (resolved)" : "") + '</strong>' +
            '    <span class="meta">Shop: ' + esc(shop) + '</span>' +
            '    <span class="meta">Product: ' + esc(product) + '</span>' +
            '    <span class="meta">Date: ' + when + '</span>' +
            (r.details ? '    <span class="meta">Details: ' + esc(r.details) + '</span>' : '') +
            '  </div>' +
            '  <div class="admin-actions">' +
            (r.resolved ? '' :
                '    <button type="button" class="btn-small" data-resolve="' + r.id + '">Mark resolved</button>') +
            (r.shop_id && r.shops && r.shops.status !== "hidden"
                ? '    <button type="button" class="btn-small" data-hide="' + r.shop_id + '">Hide shop</button>'
                : '') +
            '    <button type="button" class="btn-small btn-danger" data-delete="' + r.id + '">Delete</button>' +
            '  </div>' +
            '</li>';
    }).join("");
}

list.addEventListener("click", async function (event) {
    const resolveButton = event.target.closest("[data-resolve]");
    const hideButton = event.target.closest("[data-hide]");
    const deleteButton = event.target.closest("[data-delete]");

    if (resolveButton) {
        const result = await db.from("reports").update({ resolved: true })
            .eq("id", Number(resolveButton.dataset.resolve));
        if (result.error) { showNotice(result.error.message, true); return; }
        await loadReports();
    } else if (hideButton) {
        if (!confirm("Hide this shop? Customers will no longer see its products.")) return;
        const result = await db.from("shops").update({ status: "hidden" })
            .eq("id", Number(hideButton.dataset.hide));
        if (result.error) { showNotice(result.error.message, true); return; }
        await loadReports();
        showNotice("Shop hidden. You can approve it again on your platform admin page.", false);
    } else if (deleteButton) {
        if (!confirm("Delete this report?")) return;
        const result = await db.from("reports").delete()
            .eq("id", Number(deleteButton.dataset.delete));
        if (result.error) { showNotice(result.error.message, true); return; }
        await loadReports();
    }
});

start();
