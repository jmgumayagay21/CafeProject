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
    this.lastOrderTableId = null;
    this.lastOrderType = null;
    this.pickupTime = null; // 05/29: NEW: Track pickup time

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
    // NEW: Pass pickupTime down to the UI
    this.ui.updateCart(
      this.cart,
      this.activeQueuePosition,
      this.queue.getLength(),
      this.selectedTableId,
      this.seating.getAvailableCount(),
      this.orderType,
      this.activeQueueWait,
      this.pickupTime 
    );
    this.ui.renderSeating(this.seating, this.selectedTableId);
  }

  // NEW: Method to handle pickup time selection
  setPickupTime(time) {
    this.pickupTime = time;
  }

  setOrderType(type) {
    this.orderType = type; // 'dine-in' | 'pickup'
    if (type === 'pickup') {
      this.selectedTableId = 'takeout';
    } else {
      this.selectedTableId = null;
      this.pickupTime = null; // Clear pick up time if switched to dine-in
      this.ui.toggleCart(false);
      this.ui.toggleSeatingModal(true);
    }
    this.updateCartView();
  }

  // ─── CART FUNCTIONS ───

 // Replace your current changePreQty with this:
  changePreQty(id, delta) {
    // Find the item to check its stock
    const item = this.catalog.findItemById(id);
    const maxStock = item ? item.stocks : 99; 
    
    // Default to 0 if untouched
    if (this.ui.preQty[id] === undefined) this.ui.preQty[id] = 0;
    
    // Calculate new quantity, capping it between 0 and the max available stock
    let newQty = this.ui.preQty[id] + delta;
    this.ui.preQty[id] = Math.max(0, Math.min(maxStock, newQty)); 
    
    // Update the visual number
    const el = document.getElementById('qn-' + id);
    if (el) el.textContent = this.ui.preQty[id];
  }

  updateCartQty(id, delta) {
    this.cart.changeQty(id, delta);
  }

  // Update addToCart to handle the new 0 value properly:
  addToCart(id, name, price) {
    const item = this.catalog.findItemById(id);
    
    // 1. Determine exactly how many they want to add
    let qtyToAdd = this.ui.preQty[id];
    if (qtyToAdd === 0) return; // Do nothing if it's set to 0
    if (qtyToAdd === undefined) qtyToAdd = 1; // Default to 1 if they just clicked "+ Add" directly

    // 2. Check if adding this batch exceeds total stock limits
    const currentCartQty = this.cart.items[id] ? this.cart.items[id].qty : 0;
    if (item && (currentCartQty + qtyToAdd) > item.stocks) {
      const left = item.stocks - currentCartQty;
      this.ui.showToast(`⚠️ Cannot add more! Only ${left} left available.`);
      return;
    }

    // 3. Add to cart
    this.cart.addItem(id, name, price, qtyToAdd);
    
    // 4. Reset the quantity selector back to 0
    this.ui.preQty[id] = 0;
    if (document.getElementById('qn-' + id)) {
      document.getElementById('qn-' + id).textContent = 0;
    }
    
    this.ui.showToast(`✓ Added ${qtyToAdd}x ${name} to order`);
  }

  addDrinkToCart(id, name, price) {
  const sugarLevel = document.getElementById('sugar-' + id).value;
  const formattedName = sugarLevel !== 'Regular' ? `${name} (${sugarLevel})` : name;
  const uniqueId = sugarLevel !== 'Regular' ? `${id}-${sugarLevel}` : id;
  
  // 1. Process cart addition via unique item ID metadata
  this.addToCart(uniqueId, formattedName, price);
  
  // 2. Explicitly target and reset the underlying base view element to 0
  if (this.ui.preQty[id]) this.ui.preQty[id] = 0; 
  const el = document.getElementById('qn-' + id);
  if (el) el.textContent = 0;
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

  // Update 5/27/26: For payment processing, we need to ensure the seating status is correctly reflected in the UI and database when an order is placed. This method will be called after a successful order placement to free up the table if it's a dine-in order.

 // ─── CHECKOUT & PAYMENT ───

  proceedToPayment() {
    if (!this.selectedTableId) {
      this.ui.showToast("⚠️ Please select a seat or choose Pickup before ordering.");
      return;
    }
    this.ui.showPaymentOptions();
  }

placeOrder(paymentMethod) {
    if (!this.selectedTableId) return;

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
      total: stats.total,
      paymentMethod: paymentMethod,
      pickupTime: this.pickupTime // NEW: Include in summary
    };

    this.lastOrderDocId = null;
    this.lastOrderTableId = this.selectedTableId;
    this.lastOrderType = this.orderType;

  this.saveOrderToFirebase(orderSummary, stats, newOrder.items);

    this.cart.clear();
    this.selectedTableId = null;
    this.orderType = null;
    this.pickupTime = null; // Reset pickup time

    this.ui.togglePaymentModal(false);
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
        const orderRef = doc(collection(db, "orders"));
        transaction.set(orderRef, {
          queueNumber: summary.position,
          orderType: summary.type,
          tableId: summary.table,
          subtotal: stats.subtotal,
          tax: stats.tax,
          totalPaid: summary.total,
          paymentMethod: summary.paymentMethod, 
          pickupTime: summary.pickupTime || null, // NEW DATA FIELD
          estimatedWait: summary.waitTime,
          items: cartItems,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        this.lastOrderDocId = orderRef.id;
      });

      console.log("🎉 Secure stock deduction and order synchronization complete!");
    } catch (error) {
      console.error("Transaction failed: ", error);
      this.ui.showToast("⚠️ " + error);
    }
  }

  async cancelOrder() {
    if (this.lastOrderDocId && window.firebaseDB && window.dbMethods) {
      const db = window.firebaseDB;
      const { doc, runTransaction, serverTimestamp } = window.dbMethods;
      try {
        await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, "orders", this.lastOrderDocId);
          const orderSnap = await transaction.get(orderRef);
          if (!orderSnap.exists()) return;
          transaction.update(orderRef, {
            status: 'cancelled',
            cancelledAt: serverTimestamp()
          });
        });
        console.log("Order cancelled in database.");
      } catch (error) {
        console.error("Cancel order failed: ", error);
      }
    }

    // Stop and clear any active queue countdown so it doesn't re-show the banner
    if (this._queueTimerInterval) {
      clearInterval(this._queueTimerInterval);
      this._queueTimerInterval = null;
    }

    // Remove the order from the queue by its recorded position (if present)
    const posToRemove = this.activeQueuePosition;
    if (posToRemove && this.queue && Array.isArray(this.queue.orders)) {
      // positions are 1-based in the UI, convert to 0-based index
      const idx = posToRemove - 1;
      if (idx >= 0 && idx < this.queue.orders.length) {
        this.queue.orders.splice(idx, 1);
      }
    }

    if (this.lastOrderTableId && this.lastOrderType !== 'pickup') {
      const table = this.seating.getTables().find(t => t.id === this.lastOrderTableId);
      if (table && table.isOccupied) {
        table.free();
      }
    }

    this.activeQueuePosition = null;
    this.activeQueueWait = null;
    this.lastOrderDocId = null;
    this.lastOrderTableId = null;
    this.lastOrderType = null;

    this.cart.clear();
    this.ui.hideQueueBanner();
    this.ui.togglePaymentModal(false);
    this.ui.toggleCart(false);
    this.updateCartView();
    this.ui.showToast("Order cancelled.");
  }

  // Cancel a specific order in the in-memory queue by its 1-based position
  cancelQueueAt(position) {
    if (!position || !this.queue || !Array.isArray(this.queue.orders)) return;
    const idx = position - 1;
    if (idx < 0 || idx >= this.queue.orders.length) return;

    // If cancelling the currently active order (the one with countdown), delegate to cancelOrder
    if (this.activeQueuePosition === position) {
      this.cancelOrder();
      return;
    }

    // Remove the specified order from queue
    this.queue.orders.splice(idx, 1);

    // Adjust tracked active position if necessary
    if (this.activeQueuePosition && position < this.activeQueuePosition) {
      this.activeQueuePosition = Math.max(1, this.activeQueuePosition - 1);
    }

    // If required, adjust activeQueuePosition if it now falls outside queue bounds
    if (this.activeQueuePosition && this.activeQueuePosition > this.queue.orders.length) {
      // when the active position was removed (earlier in the queue), reset to first
      this.activeQueuePosition = this.queue.orders.length > 0 ? 1 : null;
    }

    // Close the queue list modal (if open) and refresh UI
    try { this.ui.hideQueueList(); } catch (e) { /* ignore */ }
    this.updateCartView();
    console.log(`Cancelled queue position ${position}. Remaining orders: ${this.queue.orders.length}`);
    this.ui.showToast(`Order #${position} cancelled.`);
  }

  // Update the queue countdown to trigger the new modal
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
        
        // NEW: Dynamic notification string and modal trigger
        const msg = orderSummary.type === 'pickup' 
          ? "Your order is ready for pick up at the counter!" 
          : `Your order is ready and will be served at Table ${orderSummary.table} shortly!`;
        this.ui.showOrderReadyModal(msg);
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

  // Add this method inside CafeController in controller.js
  setupPaymentValidationListeners() {
    const cardName = document.getElementById('card-name');
    const cardNumber = document.getElementById('card-number');
    const cardExpiry = document.getElementById('card-expiry');
    const cardCVV = document.getElementById('card-cvv');
    const cardConfirmBtn = document.getElementById('card-confirm-btn');

    if (!cardConfirmBtn) return;

    // If inputs aren't rendered or active yet, just skip gracefully
    if (!cardName || !cardNumber || !cardExpiry || !cardCVV) {
      cardConfirmBtn.disabled = true;
      return;
    }

    const validateForm = () => {
      const isValid = cardName.value.trim().length > 0 &&
                      cardNumber.value.replace(/\s/g, '').length >= 15 &&
                      cardExpiry.value.trim().length === 5 &&
                      cardCVV.value.trim().length >= 3;
      
      cardConfirmBtn.disabled = !isValid;
    };

    // Remove any previous duplicate listeners before applying new ones
    const inputElements = [cardName, cardNumber, cardExpiry, cardCVV];
    inputElements.forEach(input => {
      input.removeEventListener('input', validateForm);
      input.addEventListener('input', validateForm);
    });

    validateForm();
  }
}

// Instantiate App
const app = new CafeController();
window.app = app; 

window.openCart  = () => app.ui.toggleCart(true);
window.closeCart = () => app.ui.toggleCart(false);
window.proceedToPayment = () => app.proceedToPayment();     // NEW ROUTE
window.placeOrder = (method) => app.placeOrder(method);     // UPDATED ROUTE
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

window.setPickupTime = (time) => app.setPickupTime(time);
