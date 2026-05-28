class UIManager {
  constructor() {
    this.preQty = {};
  }

  tagHTML(tags) {
    return tags.map(t => {
      if (t === 'popular') return `<span class="tag tag-p">★ Popular</span>`;
      if (t === 'vegan')   return `<span class="tag tag-v">🌿 Veg</span>`;
      if (t === 'new')     return `<span class="tag tag-n">✦ New</span>`;
      return '';
    }).join('');
  }

  renderMenu(menuCatalog) {
    ['breakfast','allday','mains','sweets'].forEach(sec => {
      const grid = document.getElementById('grid-' + sec);
      if (!grid) return;
      grid.innerHTML = menuCatalog.getSection(sec).map(item => this.createFoodCard(item)).join('');
    });
    const drinksGrid = document.getElementById('grid-drinks');
    if (drinksGrid) {
      drinksGrid.innerHTML = menuCatalog.getSection('drinks').map(drink => this.createDrinkCard(drink)).join('');
    }
  }

  createFoodCard(item) {
    const isAvailable = item.stocks > 0;
    const currentQty = this.preQty[item.id] || 0; // ADD THIS LINE
      return`
      <div class="menu-card" data-id="${item.id}" data-tags="${item.tags.join(' ')}">
        <div class="card-top">
          <p class="item-name">${item.name}</p>
          <p class="item-price">₱${item.price}</p>
        </div>
        <p class="item-desc">${item.desc} <span style="color:var(--gold-light); display:block; margin-top:4px; font-size:11px;">${isAvailable ? `Stock: ${item.stocks}` : 'SOLD OUT'}</span></p>
        <div class="card-bottom">
          <div class="tags">${this.tagHTML(item.tags)}</div>
          <div class="add-wrap">
            ${isAvailable ? `
              <div class="qty-ctrl visible" id="qc-${item.id}">
                <button class="qty-btn" onclick="app.changePreQty('${item.id}', -1)">−</button>
                <span class="qty-num" id="qn-${item.id}">0</span>
                <button class="qty-btn" onclick="app.changePreQty('${item.id}', 1)">+</button>
              </div>
              <button class="add-btn" onclick="app.addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})">+ Add</button>
            ` : `
              <button class="add-btn" style="background:rgba(208,96,96,0.1); border-color:rgba(208,96,96,0.3); color:#d06060; cursor:not-allowed;" disabled>Out of Stock</button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  createDrinkCard(drink) {
    const isAvailable = drink.stocks > 0;
    return `
      <div class="drink-card">
        <div class="drink-icon">${drink.icon}</div>
        <p class="drink-name">${drink.name}</p>
        <p class="drink-desc">${drink.desc} <span style="color:var(--gold-light); display:block; font-size:11px;">${isAvailable ? `Stock: ${drink.stocks}` : 'SOLD OUT'}</span></p>
        <p class="drink-price">₱${drink.price}</p>
        <div class="drink-sugar">
          <label>Sugar</label>
          <select id="sugar-${drink.id}" class="sugar-select" ${!isAvailable ? 'disabled' : ''}>
            <option value="Regular">Regular</option>
            <option value="50%">50%</option>
            <option value="No sugar">No sugar</option>
          </select>
        </div>
        <div class="drink-add">
          ${isAvailable ? `
            <div class="qty-ctrl visible" id="qc-${drink.id}">
                <button class="qty-btn" onclick="app.changePreQty('${drink.id}', -1)">−</button>
                <span class="qty-num" id="qn-${drink.id}">0</span>
                <button class="qty-btn" onclick="app.changePreQty('${drink.id}', 1)">+</button>
              </div>
            <button class="add-btn" onclick="app.addDrinkToCart('${drink.id}', '${drink.name.replace(/'/g, "\\'")}', ${drink.price})">+ Add</button>
          ` : `
            <button class="add-btn" style="background:rgba(208,96,96,0.1); border-color:rgba(208,96,96,0.3); color:#d06060; width:95%; justify-content:center; cursor:not-allowed;" disabled>Out of Stock</button>
          `}
        </div>
      </div>
    `;
  }

  updateCart(cart, queuePos, queueLen, selectedTableId, availableCount, orderType, activeWaitTime) {
    const stats = cart.getTotals();
    const items = cart.getItems();
    const ids   = Object.keys(items);

    document.getElementById('cart-badge').textContent = stats.totalItems;
    document.getElementById('cart-badge').classList.toggle('show', stats.totalItems > 0);

    const queueEl = document.getElementById('queue-info');
    if (queuePos) {
      queueEl.textContent = activeWaitTime
        ? `#${queuePos} in queue · est. ${activeWaitTime} min`
        : `#${queuePos} in queue`;
    } else if (queueLen > 0) {
      queueEl.textContent = `(${queueLen} in queue)`;
    } else {
      queueEl.textContent = '';
    }

    const container = document.getElementById('cart-items');
    if (ids.length === 0) {
      container.innerHTML = `<div class="empty-cart"><div class="empty-icon">🛒</div><p>Your order is empty.<br>Add something delicious!</p></div>`;
    } else {
      container.innerHTML = ids.map(id => `
        <div class="cart-item">
          <div class="cart-item-info">
            <p class="cart-item-name">${items[id].name}</p>
            <p class="cart-item-price">₱${(items[id].price * items[id].qty).toLocaleString()}</p>
          </div>
          <div class="cart-item-qty">
            <button class="ciq-btn" onclick="app.updateCartQty('${id}', -1)">−</button>
            <span class="ciq-num">${items[id].qty}</span>
            <button class="ciq-btn" onclick="app.updateCartQty('${id}', 1)">+</button>
          </div>
        </div>
      `).join('');
    }

    document.getElementById('subtotal-val').textContent = `₱${stats.subtotal.toLocaleString()}`;
    document.getElementById('tax-val').textContent      = `₱${stats.tax.toLocaleString()}`;
    document.getElementById('total-val').textContent    = `₱${stats.total.toLocaleString()}`;
    document.getElementById('estimate-val').textContent = `${stats.estimatedTime} min`;

    const seatUI = document.getElementById('seat-selection-ui');
    if (seatUI) {
      const isDineIn  = orderType === 'dine-in';
      const isPickup  = orderType === 'pickup';

      if (availableCount === 0 && !isPickup) {
        seatUI.innerHTML = `
          <div class="order-type-notice">
            <p>⚠️ All seats are currently occupied.</p>
            <button class="order-type-btn order-type-btn--active" onclick="app.setOrderType('pickup')">
              🛍️ Order for Pickup instead
            </button>
          </div>`;
      } else {
        const dineLabel = isDineIn && selectedTableId
          ? `🪑 Table ${selectedTableId} — Change?`
          : `🪑 Dine In`;
        const pickupLabel = isPickup ? `✓ Store Pickup Selected` : `🛍️ Store Pickup`;

        seatUI.innerHTML = `
          <div class="order-type-toggle">
            <button class="order-type-btn ${isDineIn ? 'order-type-btn--active' : ''}"
                    onclick="app.setOrderType('dine-in')">
              ${dineLabel}
            </button>
            <button class="order-type-btn ${isPickup ? 'order-type-btn--active order-type-btn--pickup' : ''}"
                    onclick="app.setOrderType('pickup')">
              ${pickupLabel}
            </button>
          </div>
          ${isDineIn && !selectedTableId ? `<p class="seat-hint">👆 Select a table from the floor plan</p>` : ''}
        `;
      }
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = (ids.length === 0 || !selectedTableId);
    }
const placeOrderBtn = document.getElementById('real-place-order-btn');
    if (placeOrderBtn) {
      placeOrderBtn.disabled = (ids.length === 0 || !selectedTableId);
    }
  }

  renderSeating(seatingManager, selectedTableId) {
    const container = document.getElementById('floor-plan');
    if (!container) return;

    const tables      = seatingManager.getTables();
    const smallTables = tables.filter(t => t.type === 'small');
    const largeTables = tables.filter(t => t.type === 'large');
    const barTables   = tables.filter(t => t.type === 'bar');
    const available   = seatingManager.getAvailableCount();
    const total       = tables.length;
    const occupied    = total - available;

    const createTableHTML = (t) => {
      let statusClass = 'available';
      if (t.isOccupied)                   statusClass = 'occupied';
      else if (t.id === selectedTableId)  statusClass = 'selected';

      const label = t.type === 'small' ? `S${t.id.replace('t-s','')}`
                  : t.type === 'large' ? `L${t.id.replace('t-L','')}`
                  : `B${t.id.replace('b','')}`; 

      const capacityIcon = t.type === 'bar' ? '' : `<span class="time-stamp" style="opacity:0.65;font-size:8px">👤×${t.capacity}</span>`;

      return `
        <div class="table-node table-${t.type} ${statusClass}"
             onclick="app.selectTable('${t.id}')"
             title="${statusClass === 'occupied' ? `Occupied since ${t.getOccupiedTimeString()}` : statusClass === 'selected' ? 'Your table' : `Available · ${t.capacity} seats`}">
          <span class="table-id">${label}</span>
          ${t.isOccupied
            ? `<span class="time-stamp">since ${t.getOccupiedTimeString()}</span>`
            : (t.id === selectedTableId ? '' : capacityIcon)
          }
        </div>`;
    };

    const statsBar = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;font-family:'Outfit',sans-serif;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8B7355;font-weight:600;margin-bottom:3px;">Table Status</div>
          <div style="display:flex;gap:3px;">
            <div style="height:5px;border-radius:3px 0 0 3px;background:#7EA86A;width:${Math.round(available/total*100)}%;transition:width 0.4s;"></div>
            <div style="height:5px;border-radius:0 3px 3px 0;background:#C96A40;width:${Math.round(occupied/total*100)}%;transition:width 0.4s;"></div>
          </div>
        </div>
        <div style="font-size:11px;color:#5E8A4C;font-weight:600;white-space:nowrap;">${available} open</div>
        <div style="font-size:11px;color:#A84F28;font-weight:600;white-space:nowrap;">${occupied} taken</div>
      </div>`;

    const legend = `
      <div class="fp-legend">
        <div class="fp-legend-item"><div class="fp-legend-dot available"></div> Available</div>
        <div class="fp-legend-item"><div class="fp-legend-dot occupied"></div> Occupied</div>
        <div class="fp-legend-item"><div class="fp-legend-dot selected"></div> Your Table</div>
        <div class="fp-legend-item"><div class="fp-legend-dot bar" style="border-radius:50%"></div> Bar Stool</div>
      </div>`;

    container.innerHTML = `
      <div class="floor-plan-wrap">
        ${statsBar}
        ${legend}
        <div class="floor-texture">
          <div class="floor-plan-grid">
            <div class="fp-column">
              <div class="fp-zone-label">Window<br>Tables</div>
              ${smallTables.map(createTableHTML).join('')}
            </div>
            <div class="fp-column">
              <div class="fp-cashier">☕ Cashier · Order Pick-up</div>
              <div class="fp-zone-label">Main Dining</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                ${largeTables.map(createTableHTML).join('')}
              </div>
            </div>
            <div class="fp-column" style="align-items:center">
              <div class="fp-zone-label" style="text-align:center">Bar</div>
              ${barTables.map(createTableHTML).join('')}
            </div>
          </div>
        </div>
      </div>`;

    const seatCountBtn = document.getElementById('seat-count-btn');
    if (seatCountBtn) seatCountBtn.textContent = `${available} Seats Available`;
  }

  toggleCart(forceState) {
    const drawer  = document.getElementById('cart-drawer');
    const overlay = document.getElementById('overlay');
    if (drawer)  drawer.classList.toggle('open', forceState);
    if (overlay) overlay.classList.toggle('open', forceState);
  }

  toggleSeatingModal(forceState) {
    const modal   = document.getElementById('seating-modal');
    const overlay = document.getElementById('overlay');
    if (modal)   modal.classList.toggle('open', forceState);
    if (overlay) overlay.classList.toggle('open', forceState);
  }

  showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
  }

  showOrderConfirmation(summary) {
    const modal = document.getElementById('order-confirm-modal');
    if (!modal) return;
    const locationLine = summary.type === 'pickup'
      ? '🛍️ Pickup at counter'
      : `🪑 Table ${summary.table}`;
    document.getElementById('oc-queue').textContent  = `#${summary.position}`;
    document.getElementById('oc-location').textContent = locationLine;
    document.getElementById('oc-total').textContent  = `₱${summary.total.toLocaleString()}`;
    modal.classList.add('open');
    document.getElementById('overlay').classList.add('open');
  }

  hideOrderConfirmation() {
    const modal = document.getElementById('order-confirm-modal');
    if (modal) modal.classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
  }

  updateQueueBanner(position, mins, secs, type, table) {
    let banner = document.getElementById('queue-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'queue-banner';
      banner.className = 'queue-banner';
      document.body.appendChild(banner);
    }
    const pad = n => String(n).padStart(2, '0');
    const loc = type === 'pickup' ? 'Pickup at counter' : `Table ${table}`;
    banner.innerHTML = `
      <div class="qb-inner">
        <span class="qb-badge">#${position}</span>
        <div class="qb-info">
          <span class="qb-label">Your order · ${loc}</span>
          <span class="qb-timer">${pad(mins)}<em>:</em>${pad(secs)}<span class="qb-unit"> remaining</span></span>
        </div>
        <div class="qb-actions">
          <button class="qb-view" onclick="app.ui.showQueueList()">View Queue</button>
          <button class="qb-cancel" onclick="app.cancelOrder()">Cancel Order</button>
          <button class="qb-close" onclick="app.ui.hideQueueBanner()">✕</button>
        </div>
      </div>`;
    banner.classList.add('visible');
  }

  hideQueueBanner() {
    const banner = document.getElementById('queue-banner');
    if (banner) banner.classList.remove('visible');
  }

  // Small modal to show current orders in the queue
  showQueueList() {
    // remove existing if present
    let modal = document.getElementById('queue-list-modal');
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'queue-list-modal';
    modal.className = 'queue-list-modal';

    const orders = (window.app && window.app.queue && window.app.queue.orders) ? window.app.queue.orders : [];

    const listHTML = orders.length === 0
      ? '<div class="ql-empty">No active orders.</div>'
      : `<div class="ql-list">${orders.map((o, i) => {
          const isFirst = i === 0;
          const items = Object.keys(o.items || {}).map(k => `${o.items[k].qty}× ${o.items[k].name || k}`).join('<br>');
          const ts = o.timestamp ? new Date(o.timestamp).toLocaleTimeString() : '';
          return `<div class="ql-item ${isFirst? 'first':''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                      <div>
                        <div class="ql-pos">#${i+1}${isFirst? ' · First':''}</div>
                        <div class="ql-meta">Prep: ${o.prepTime || '-'} min ${ts? '· ' + ts : ''}</div>
                      </div>
                      <div>
                        <button class="ql-item-cancel" onclick="app.cancelQueueAt(${i+1})">Cancel</button>
                      </div>
                    </div>
                    <div class="ql-items">${items}</div>
                  </div>`;
        }).join('')}</div>`;

    modal.innerHTML = `
      <div class="ql-inner">
        <div class="ql-head">
          <h3>Current Queue (${orders.length})</h3>
          <button class="close-btn ql-close">✕</button>
        </div>
        <div class="ql-body">${listHTML}</div>
      </div>`;

    document.body.appendChild(modal);

    modal.querySelector('.ql-close').addEventListener('click', () => this.hideQueueList());
  }

  hideQueueList() {
    const modal = document.getElementById('queue-list-modal');
    if (modal) modal.remove();
  }


// ─── PAYMENT UI METHODS ───

 showPaymentOptions() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('open');

    // Display Step 1 matrix options properly, hide the rest
    document.getElementById('payment-step-1').style.display = 'flex';
    document.getElementById('payment-step-2').style.display = 'none';
    document.getElementById('payment-step-3').style.display = 'none'; // Clear step 3 visibility remnants
    
    document.getElementById('payment-subtitle').textContent = "Select how you'd like to pay.";
    
    const backBtn = document.getElementById('payment-back-btn');
    backBtn.innerHTML = '← Back to Order';
    backBtn.onclick = () => {
      this.togglePaymentModal(false);
    };
  }

  showQRPayment() {
    // Display Step 2 QR layout options properly, hide the rest
    document.getElementById('payment-step-1').style.display = 'none';
    document.getElementById('payment-step-2').style.display = 'flex';
    document.getElementById('payment-step-3').style.display = 'none'; // Clear step 3 visibility remnants
    
    document.getElementById('payment-subtitle').textContent = "Scan QR to complete payment.";
    
    const backBtn = document.getElementById('payment-back-btn');
    backBtn.innerHTML = '← Back to Options';
    backBtn.onclick = () => {
      this.showPaymentOptions();
    };
  }

  togglePaymentModal(forceState) {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.toggle('open', forceState);
  }

  showCardForm() {
  // Hide initial payment options matrix
  document.getElementById('payment-step-1').style.display = 'none';
  // Hide QR Payment container if active
  document.getElementById('payment-step-2').style.display = 'none';
  
  // Reveal the hidden credit/debit card details form
  document.getElementById('payment-step-3').style.display = 'flex';
  document.getElementById('payment-subtitle').textContent = "Enter your card details.";

  // Update total value display target within card submit context 
  const stats = this.cart ? this.cart.getTotals() : { total: 0 };
  const cardTotalSpan = document.getElementById('card-pay-total');
  if (cardTotalSpan) {
    cardTotalSpan.textContent = stats.total.toLocaleString();
  }
  
  // Rewire back button functionality to return cleanly to step 1
  const backBtn = document.getElementById('payment-back-btn');
  if (backBtn) {
    backBtn.innerHTML = '← Back to Options';
    backBtn.onclick = () => {
      this.showPaymentOptions();
    };
  }

  // Wire up card input validation after the form is visible in the DOM
  if (window.app) window.app.setupPaymentValidationListeners();

}
}

