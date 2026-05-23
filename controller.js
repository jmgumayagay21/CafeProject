class CafeController {
  constructor() {
    this.catalog = new MenuCatalog();
    this.cart = new Cart();
    this.queue = new OrderQueue();
    this.seating = new SeatingManager();
    this.ui = new UIManager();
    
    this.activeQueuePosition = null;
    this.selectedTableId = null; 

    // THE OBSERVER IN ACTION: The Controller listens to the Cart.
    // Anytime the cart calls this.notify(), this function runs automatically!
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
    this.ui.updateCart(this.cart, this.activeQueuePosition, this.queue.getLength(), this.selectedTableId, this.seating.getAvailableCount());
    this.ui.renderSeating(this.seating, this.selectedTableId);
  }

  // ─── RESTORED CART FUNCTIONS ───

  changePreQty(id, delta) {
    if (!this.ui.preQty[id]) this.ui.preQty[id] = 1;
    this.ui.preQty[id] = Math.max(1, this.ui.preQty[id] + delta);
    const el = document.getElementById('qn-' + id);
    if (el) el.textContent = this.ui.preQty[id];
  }

  addToCart(id, name, price) {
    const qty = this.ui.preQty[id] || 1;
    
    // Adding the item now automatically triggers updateCartView() via the Observer!
    this.cart.addItem(id, name, price, qty); 
    
    this.ui.preQty[id] = 1; 
    if (document.getElementById('qn-' + id)) document.getElementById('qn-' + id).textContent = 1;
    this.ui.showToast(`✓ Added ${name} to order`);
  }

  addDrinkToCart(id, name, price) {
    const sugarLevel = document.getElementById('sugar-' + id).value;
    const formattedName = sugarLevel !== 'Regular' ? `${name} (${sugarLevel})` : name;
    const uniqueId = sugarLevel !== 'Regular' ? `${id}-${sugarLevel}` : id;
    this.addToCart(uniqueId, formattedName, price);
  }

  updateCartQty(id, delta) {
    // This automatically triggers the UI update via Observer
    this.cart.changeQty(id, delta); 
  }

  // ─── SEATING & ORDERING ───

  selectTable(id) {
    const table = this.seating.getTables().find(t => t.id === id);
    if (table.isOccupied) {
      this.ui.showToast("This table is currently occupied.");
      return;
    }
    this.selectedTableId = (this.selectedTableId === id) ? null : id;
    this.updateCartView();
  }

  setTakeout() {
    this.selectedTableId = 'takeout';
    this.updateCartView();
  }

  placeOrder() {
    if (!this.selectedTableId) {
      this.ui.showToast("⚠️ Please select a seat or choose Takeaway before ordering.");
      this.ui.toggleSeatingModal(true);
      return;
    }

    const stats = this.cart.getTotals();
    const newOrder = new Order({...this.cart.getItems()}, stats.estimatedTime);
    this.activeQueuePosition = this.queue.addOrder(newOrder);
    const waitTime = this.queue.getEstimatedWait(this.activeQueuePosition, stats.estimatedTime);
    
    if (this.selectedTableId !== 'takeout') {
      this.seating.toggleTableStatus(this.selectedTableId);
    }

    // Clearing the cart automatically triggers the UI update via Observer
    this.cart.clear(); 
    this.selectedTableId = null; 
    
    this.ui.toggleCart(false);
    this.ui.showToast(`✓ Order placed! You are #${this.activeQueuePosition}. Wait: ~${waitTime} min.`);
  }

  async checkInventoryAndOrder(orderData) {
    try {
      const response = await fetch('http://localhost:8000/api/place-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const result = await response.json();
      if (result.success) this.finalizeOrder(); 
      else this.ui.showToast("⚠️ " + result.error_message); 
    } catch (error) {
      this.ui.showToast("Cannot connect to the database.");
    }
  }
}

// ==========================================================
// INSTANTIATE THE APP
// ==========================================================
const app = new CafeController();

window.openCart = () => app.ui.toggleCart(true);
window.closeCart = () => app.ui.toggleCart(false);
window.placeOrder = () => app.placeOrder();
window.clearCart = () => app.cart.clear(); // The Observer handles the UI update!

window.setCategory = (cat, btn) => {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.menu-section').forEach(s => s.style.display = 'none');
  document.getElementById(cat).style.display = 'block';
};