class CafeController {
  constructor() {
    this.catalog = new MenuCatalog();
    this.cart = new Cart();
    this.queue = new OrderQueue();
    this.seating = new SeatingManager();
    this.ui = new UIManager();
    
    this.activeQueuePosition = null;
    this.activeQueueWait = null;
    this.selectedTableId = null;
    this.orderType = null; // 'dine-in' | 'pickup'
    this._queueTimerInterval = null;

    this.cart.subscribe(() => {
      this.updateCartView();
    });

    this.init();
  }

  init() {
    this.ui.renderMenu(this.catalog);
    this.updateCartView();
  }

  updateCartView() {
    this.ui.updateCart(
      this.cart,
      this.activeQueuePosition,
      this.queue.getLength(),
      this.selectedTableId,
      this.seating.getAvailableCount(),
      this.orderType,
      this.activeQueueWait
    );
    this.ui.renderSeating(this.seating, this.selectedTableId);
  }

  // ─── CART FUNCTIONS ───
// Update 5/26 - To change/update the quantity of items 0
  changePreQty(id, delta) {
    // If it doesn't exist yet, initialize it at 1
    if (this.ui.preQty[id] === undefined) this.ui.preQty[id] = 1;
    
    // Allow it to drop down to 0 instead of stopping at 1
    this.ui.preQty[id] = Math.max(0, this.ui.preQty[id] + delta);
    
    // Support both 'qn-special-item' or the older 'special-qty-num' ID fallback
    let el = document.getElementById('qn-' + id);
    if (id === 'special-item' && !el) {
      el = document.getElementById('special-qty-num');
    }
    
    if (el) el.textContent = this.ui.preQty[id];
  }

  addToCart(id, name, price) {
    const qty = this.ui.preQty[id] !== undefined ? this.ui.preQty[id] : 1;
    
    // NEW: Guard check validation clause preventing 0 additions
    if (qty <= 0) {
      this.ui.showToast("⚠️ Please select a quantity of 1 or more.");
      return;
    }
    
    // Adding the item now automatically triggers updateCartView() via the Observer!
    this.cart.addItem(id, name, price, qty); 
    
    // Reset tracker back to 1 after a successful order validation pass
    this.ui.preQty[id] = 1; 
    
    // Update displays
    let el = document.getElementById('qn-' + id);
    if (id === 'special-item' && !el) el = document.getElementById('special-qty-num');
    if (el) el.textContent = 1;
    
    this.ui.showToast(`✓ Added ${name} to order`);
  }
// Update 5/26 - To have Sugarlevel 25% and 75% and Quantity selection for drinks
  addDrinkToCart(id, name, price) {
    // 1. Get the configured sugar selection level
    const sugarLevel = document.getElementById('sugar-' + id).value;
    const formattedName = sugarLevel !== 'Regular' ? `${name} (${sugarLevel})` : name;
    const uniqueId = sugarLevel !== 'Regular' ? `${id}-${sugarLevel}` : id;
    
    // 2. Extract the current quantity input value from preQty tracker
    const qty = this.ui.preQty[id] || 1;
    
    // 3. Direct add item interaction with the exact count
    this.cart.addItem(uniqueId, formattedName, price, qty); 
    
    // 4. Reset tracker data state and local interface displays back to 1
    this.ui.preQty[id] = 1; 
    if (document.getElementById('qn-' + id)) {
      document.getElementById('qn-' + id).textContent = 1;
    }
    
    this.ui.showToast(`✓ Added ${qty}x ${formattedName} to order`);
  }

  updateCartQty(id, delta) {
    this.cart.changeQty(id, delta);
  }

  // ─── ORDER TYPE ───

  setOrderType(type) {
    this.orderType = type; // 'dine-in' | 'pickup'
    if (type === 'pickup') {
      this.selectedTableId = 'takeout';
    } else {
      this.selectedTableId = null;
      this.ui.toggleCart(false);
      this.ui.toggleSeatingModal(true);
    }
    this.updateCartView();
  }

  // ─── SEATING ───

  selectTable(id) {
    const table = this.seating.getTables().find(t => t.id === id);
    if (table.isOccupied) {
      this.ui.showToast("This table is currently occupied.");
      return;
    }
    this.selectedTableId = (this.selectedTableId === id) ? null : id;
    this.orderType = 'dine-in';
    this.updateCartView();
    this.ui.toggleSeatingModal(false);
    this.ui.toggleCart(true);
  }

  setTakeout() {
    this.selectedTableId = 'takeout';
    this.orderType = 'pickup';
    this.updateCartView();
  }

  // ─── PLACE ORDER ───

  placeOrder() {
    if (!this.selectedTableId) {
      this.ui.showToast("⚠️ Please select a seat or choose Pickup before ordering.");
      return;
    }

    const stats = this.cart.getTotals();
    const newOrder = new Order({...this.cart.getItems()}, stats.estimatedTime);
    this.activeQueuePosition = this.queue.addOrder(newOrder);
    const waitTime = this.queue.getEstimatedWait(this.activeQueuePosition, stats.estimatedTime);
    this.activeQueueWait = waitTime;

    if (this.selectedTableId !== 'takeout') {
      this.seating.toggleTableStatus(this.selectedTableId);
    }

    const orderSummary = {
      position: this.activeQueuePosition,
      waitTime,
      type: this.orderType,
      table: this.selectedTableId,
      total: stats.total
    };

     // Firebase Data Transmit Call with stock checking transaction
    this.saveOrderToFirebase(orderSummary, stats, newOrder.items);

    this.cart.clear();
    this.selectedTableId = null;
    this.orderType = null;

    this.ui.toggleCart(false);
    this._startQueueCountdown(orderSummary);
    this.ui.showOrderConfirmation(orderSummary);
  }

  // CLOUD ATOMIC TRANSACTIONS: Reads dynamic states, blocks invalid buys, updates fields safely
  async saveOrderToFirebase(summary, stats, cartItems) {
    if (!window.firebaseDB || !window.dbMethods) {
      console.warn("Firebase not ready or active.");
      return;
    }

    const db = window.firebaseDB;
    const { collection, addDoc, doc, runTransaction, serverTimestamp } = window.dbMethods;

    try {
      await runTransaction(db, async (transaction) => {
        const itemIds = Object.keys(cartItems);
        let docsToUpdate = [];

        for (let id of itemIds) {
          // FIXED: Prevents slicing 'special-item' into 'special' while correctly parsing drink variants
          const cleanId = id === 'special-item' ? id : id.split('-')[0];
          
          const productRef = doc(db, "products", cleanId);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            throw `Product ID ${cleanId} does not exist in the store directory!`;
          }

          const currentStock = productSnap.data().stocks ?? 0;
          const requestedQty = cartItems[id].qty;

          if (currentStock < requestedQty) {
            throw `Sorry, ${cartItems[id].name} is insufficient in stock!`;
          }

          docsToUpdate.push({ ref: productRef, newStock: currentStock - requestedQty });
        }

        // Apply calculated updates sequentially across active item array targets
        for (let update of docsToUpdate) {
          transaction.update(update.ref, { stocks: update.newStock });
        }

        // Write order receipt log entry to database
        await addDoc(collection(db, "orders"), {
          queueNumber: summary.position,
          orderType: summary.type,
          tableId: summary.table,
          subtotal: stats.subtotal,
          tax: stats.tax,
          totalPaid: summary.total,
          estimatedWait: summary.waitTime,
          items: cartItems, 
          createdAt: serverTimestamp()
        });
      });

      console.log("🎉 Secure stock deduction and order synchronization complete!");
    } catch (error) {
      console.error("Transaction failed: ", error);
      this.ui.showToast("⚠️ " + error);
    }
  }

  _startQueueCountdown(orderSummary) {
    if (this._queueTimerInterval) clearInterval(this._queueTimerInterval);
    let remaining = orderSummary.waitTime * 60; 

    const updateTimer = () => {
      if (remaining <= 0) {
        clearInterval(this._queueTimerInterval);
        this._queueTimerInterval = null;
        this.activeQueuePosition = null;
        this.activeQueueWait = null;
        this.ui.hideQueueBanner();
        this.updateCartView();
        this.ui.showToast("🎉 Your order is ready!");
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      this.ui.updateQueueBanner(
        orderSummary.position,
        mins,
        secs,
        orderSummary.type,
        orderSummary.table
      );
      remaining--;
    };

    updateTimer();
    this._queueTimerInterval = setInterval(updateTimer, 1000);
  }
}

// Instantiate App
const app = new CafeController();

window.openCart  = () => app.ui.toggleCart(true);
window.closeCart = () => app.ui.toggleCart(false);
window.placeOrder = () => app.placeOrder();
window.clearCart  = () => app.cart.clear();

window.setCategory = (cat, btn) => {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(s => s.style.display = 'none');
  document.getElementById(cat).style.display = 'block';
};

window.setFilter = (tag, btn) => {
  document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-card').forEach(card => {
    if (tag === 'all') { card.style.display = ''; return; }
    const tags = card.dataset.tags || '';
    card.style.display = tags.includes(tag) ? '' : 'none';
  });
};