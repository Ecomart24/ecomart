// Cart stored in localStorage
function getCart() {
  try { return JSON.parse(localStorage.getItem("fk_cart") || "[]"); } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem("fk_cart", JSON.stringify(cart));
  updateCartBadge();
}
function addToCart(product) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.id === product.id);
  if (idx >= 0) { cart[idx].qty += 1; } else { cart.push({ ...product, qty: 1 }); }
  saveCart(cart);
  showAddToCartCard(product);
}
function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id));
}
function updateQty(id, qty) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.id === id);
  if (idx >= 0) {
    if (qty <= 0) { cart.splice(idx, 1); } else { cart[idx].qty = qty; }
    saveCart(cart);
  }
}
function getCartCount() { return getCart().reduce((s, i) => s + i.qty, 0); }
function getCartTotal() { return getCart().reduce((s, i) => s + i.price * i.qty, 0); }
function getCartOriginalTotal() { return getCart().reduce((s, i) => s + i.originalPrice * i.qty, 0); }
function getCartDiscount() { return getCartOriginalTotal() - getCartTotal(); }
function clearCart() { localStorage.removeItem("fk_cart"); updateCartBadge(); }

function updateCartBadge() {
  const el = document.querySelector(".cart-badge");
  if (el) { const c = getCartCount(); el.textContent = c; el.style.display = c > 0 ? "flex" : "none"; }
}

function ensureAddToCartCard() {
  let card = document.getElementById("fk-add-card");
  if (card) return card;

  card = document.createElement("div");
  card.id = "fk-add-card";
  card.className = "fk-add-card";
  card.innerHTML = `
    <button class="fk-add-card-close" type="button" aria-label="Close">×</button>
    <div class="fk-add-card-row">
      <img class="fk-add-card-img" alt="Added product" />
      <div class="fk-add-card-info">
        <div class="fk-add-card-title"></div>
        <div class="fk-add-card-status">Added to cart</div>
      </div>
    </div>
    <button class="fk-add-card-btn" type="button">Go to Checkout</button>
  `;

  card.querySelector(".fk-add-card-close").addEventListener("click", () => {
    card.classList.remove("show");
  });
  card.querySelector(".fk-add-card-btn").addEventListener("click", () => {
    location.href = "checkout.html";
  });

  document.body.appendChild(card);
  return card;
}

function showAddToCartCard(product) {
  const card = ensureAddToCartCard();
  const img = card.querySelector(".fk-add-card-img");
  const title = card.querySelector(".fk-add-card-title");

  img.src = product.image || "";
  img.onerror = () => { img.style.opacity = "0.35"; };
  img.style.opacity = "1";
  title.textContent = product.name || "Product";

  card.classList.add("show");
  clearTimeout(card._timer);
  card._timer = setTimeout(() => {
    card.classList.remove("show");
  }, 5000);
}

// Header HTML injected on each page
function renderHeader() {
  const count = getCartCount();
  return `
    <header class="header">
      <div class="header-inner">
        <a href="index.html" class="logo-block" style="text-decoration:none">
          <div class="logo">Flipkart <span>&#9733;</span></div>
          <div class="explore-plus">Explore Plus+</div>
        </a>
        <div class="search-bar">
          <input type="text" placeholder="Search for products, brands and more" id="search-input" />
          <button class="search-btn" onclick="handleSearch()">
            <svg viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
          </button>
        </div>
        <div class="header-actions">
          <button class="header-btn" onclick="location.href='index.html'">Login</button>
          <button class="header-btn" onclick="location.href='cart.html'">
            Cart <span class="cart-badge" style="display:${count > 0 ? "flex" : "none"}">${count}</span>
          </button>
          <button class="header-btn">Become a Seller</button>
          <button class="header-btn">More &#9662;</button>
        </div>
      </div>
    </header>
    <nav class="navbar">
      <div class="navbar-inner">
        ${["Mobiles","Laptops","Electronics","TVs","Tablets","Cameras","Fashion","Cosmetics","Footwear"].map(c => `<div class="nav-item">${c}</div>`).join("")}
      </div>
    </nav>`;
}

function renderFooter() {
  return `
    <footer>
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-col"><h4>About</h4><a href="#">Contact Us</a><a href="#">About Us</a><a href="#">Careers</a><a href="#">Press</a></div>
          <div class="footer-col"><h4>Help</h4><a href="#">Payments</a><a href="#">Shipping</a><a href="#">Return Policy</a><a href="#">FAQ</a></div>
          <div class="footer-col"><h4>Policy</h4><a href="#">Cancellation &amp; Returns</a><a href="#">Terms of Use</a><a href="#">Privacy</a><a href="#">Grievance</a></div>
          <div class="footer-col"><h4>Social</h4><a href="#">Facebook</a><a href="#">Twitter</a><a href="#">YouTube</a><a href="#">Instagram</a></div>
        </div>
        <div class="footer-bottom">Copyright 2026 Flipkart. All rights reserved.</div>
      </div>
    </footer>`;
}

function handleSearch() {
  const q = document.getElementById("search-input")?.value;
  if (q) alert("Searching for: " + q);
}

function ratingClass(r) { return r >= 4 ? "green" : r >= 3 ? "orange" : "red"; }

function productCardHTML(p) {
  return `
    <div class="product-card">
      <div class="sale-badge"><div>SALE</div><div class="pct">${p.discount}%</div><div>OFF</div></div>
      <img class="product-img" src="${p.image}" alt="${p.name}" onclick="location.href='product.html?id=${p.id}'" onerror="this.style.opacity=0.3" loading="lazy" />
      <div class="product-name" onclick="location.href='product.html?id=${p.id}'">${p.name.substring(0, 70)}${p.name.length > 70 ? "..." : ""}</div>
      <div class="rating">
        <span class="rating-badge ${ratingClass(p.rating)}">${p.rating} &#9733;</span>
        <span class="reviews">(${p.reviews.toLocaleString()})</span>
      </div>
      <div class="price-row">
        <span class="price-current">&#8377;${p.price}</span>
        <span class="price-original">&#8377;${p.originalPrice}</span>
        <span class="price-off">${p.discount}% off</span>
      </div>
      <button class="add-to-cart-btn" onclick='addToCart(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="20" r="1"></circle>
          <circle cx="18" cy="20" r="1"></circle>
          <path d="M2 3h2l2.6 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 7H7"></path>
        </svg>
        Add to Cart
      </button>
    </div>`;
}
