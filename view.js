class UIManager {
  constructor() {
    this.preQty = {};
  }

  tagHTML(tags) {
    return tags.map(t => {
      if (t === 'popular') return `<span class="tag tag-p">★ Popular</span>`;
      if (t === 'vegan') return `<span class="tag tag-v">🌿 Veg</span>`;
      if (t === 'new') return `<span class="tag tag-n">✦ New</span>`;
      return '';
    }).join('');
  }

  renderMenu(menuCatalog) {
    ['breakfast', 'allday', 'mains', 'sweets'].forEach(sec => {
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
    return `
      <div class="menu-card" data-id="${item.id}" data-tags="${item.tags.join(' ')}">
        <div class="card-top">
          <p class="item-name">${item.name}</p>
          <p class="item-price">₱${item.price}</p>
        </div>
        <p class="item-desc">${item.desc}</p>
        <div class="card-bottom">
          <div class="tags">${this.tagHTML(item.tags)}</div>
          <div class="add-wrap">
            <div class="qty-ctrl visible" id="qc-${item.id}">
              <button class="qty-btn" onclick="app.changePreQty('${item.id}', -1)">−</button>
              <span class="qty-num" id="qn-${item.id}">1</span>
              <button class="qty-btn" onclick="app.changePreQty('${item.id}', 1)">+</button>
            </div>
            <button class="add-btn" onclick="app.addToCart('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})">+ Add</button>
          </div>
        </div>
      </div>
    `;
  }

  createDrinkCard(drink) {
    return `
      <div class="drink-card">
        <div class="drink-icon">${drink.icon}</div>
        <p class="drink-name">${drink.name}</p>
        <p class="drink-desc">${drink.desc}</p>
        <p class="drink-price">₱${drink.price}</p>
        <div class="drink-sugar">
          <label>Sugar</label>
          <select id="sugar-${drink.id}" class="sugar-select">
            <option value="Regular">Regular</option>
            <option value="50%">50%</option>
            <option value="No sugar">No sugar</option>
          </select>
        </div>
        <div class="drink-add">
          <button class="add-btn" onclick="app.addDrinkToCart('${drink.id}', '${drink.name.replace(/'/g, "\\'")}', ${drink.price})">+ Add</button>
        </div>
      </div>
    `;
  }

  updateCart(cart, queuePos, queueLen, selectedTableId, availableCount) {
    const stats = cart.getTotals();
    const items = cart.getItems();
    const ids = Object.keys(items);

    // 1. Update Badge
    document.getElementById('cart-badge').textContent = stats.totalItems;
    document.getElementById('cart-badge').classList.toggle('show', stats.totalItems > 0);

    // 2. Update Cart Items
    const container = document.getElementById('cart-items');
    if (ids.length === 0) {
      container.innerHTML = `<div class="empty-cart"><p>Your order is empty.</p></div>`;
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

    // 3. Update Totals
    document.getElementById('subtotal-val').textContent = `₱${stats.subtotal.toLocaleString()}`;
    document.getElementById('tax-val').textContent = `₱${stats.tax.toLocaleString()}`;
    document.getElementById('total-val').textContent = `₱${stats.total.toLocaleString()}`;
    document.getElementById('estimate-val').textContent = `${stats.estimatedTime} min`;

    // 4. Queue Info
    const queueEl = document.getElementById('queue-info');
    if (queuePos) queueEl.textContent = `#${queuePos} in queue`;
    else if (queueLen > 0) queueEl.textContent = `(${queueLen} in queue)`;
    else queueEl.textContent = '';

    // 5. Dynamic Seat Selection UI
    const seatSelectionContainer = document.getElementById('seat-selection-ui');
    if (seatSelectionContainer) {
      if (availableCount === 0) {
        seatSelectionContainer.innerHTML = `
          <div style="background: rgba(208,96,96,0.1); border: 1px solid rgba(208,96,96,0.3); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
            <p style="color: #d06060; font-size: 12px; margin-bottom: 8px;">⚠️ All seats are currently occupied.</p>
            <button class="clear-btn" style="margin:0; border-color: #d06060; color: #d06060;" onclick="app.setTakeout()">
              ${selectedTableId === 'takeout' ? '✓ Takeaway Selected' : 'Order for Takeaway instead'}
            </button>
          </div>
        `;
      } else {
        let seatText = "🪑 Select a Seat";
        if (selectedTableId === 'takeout') seatText = "🛍️ Takeaway Selected (Change?)";
        else if (selectedTableId) seatText = `🪑 Table ${selectedTableId} Selected (Change?)`;

        seatSelectionContainer.innerHTML = `
          <button class="clear-btn" style="margin-top: 0; margin-bottom: 16px; border-color: var(--gold-dim); color: var(--gold);" 
                  onclick="app.ui.toggleCart(false); app.ui.toggleSeatingModal(true);">
            ${seatText}
          </button>
        `;
      }
    }

    // 6. Disable checkout if no seat/takeout is selected OR cart is empty
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = (ids.length === 0 || !selectedTableId);
    }
  }

  // --- THESE WERE THE MISSING METHODS ---

  renderSeating(seatingManager, selectedTableId) {
    const container = document.getElementById('floor-plan');
    if (!container) return;

    const tables = seatingManager.getTables();
    const smallTables = tables.filter(t => t.type === 'small');
    const largeTables = tables.filter(t => t.type === 'large');
    const barTables = tables.filter(t => t.type === 'bar');

    const createTableHTML = (t) => {
      let statusClass = 'available';
      if (t.isOccupied) statusClass = 'occupied';
      else if (t.id === selectedTableId) statusClass = 'selected';

      return `
        <div class="table-node table-${t.type} ${statusClass}" 
             onclick="app.selectTable('${t.id}')">
          <span>${t.id}</span>
          ${t.isOccupied ? `<span class="time-stamp">${t.getOccupiedTimeString()}</span>` : ''}
        </div>
      `;
    };

    container.innerHTML = `
      <div class="fp-column" style="margin-top: 40px;">${smallTables.map(createTableHTML).join('')}</div>
      <div class="fp-column">
        <div style="background: #1d5f7b; color: white; text-align: center; padding: 10px; border-radius: 5px; font-size: 12px; margin-bottom: 20px;">Cashier – Order Pick Up</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">${largeTables.map(createTableHTML).join('')}</div>
      </div>
      <div class="fp-column" style="align-items: center;">${barTables.map(createTableHTML).join('')}</div>
    `;

    const seatCountBtn = document.getElementById('seat-count-btn');
    if(seatCountBtn) {
        seatCountBtn.textContent = `${seatingManager.getAvailableCount()} Seats Available`;
    }
  }

  toggleCart(forceState) {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('overlay');
    if(drawer) drawer.classList.toggle('open', forceState);
    if(overlay) overlay.classList.toggle('open', forceState);
  }

  toggleSeatingModal(forceState) {
    const modal = document.getElementById('seating-modal');
    const overlay = document.getElementById('overlay');
    if(modal) modal.classList.toggle('open', forceState);
    if(overlay) overlay.classList.toggle('open', forceState);
  }

  showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
}