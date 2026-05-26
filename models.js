// Base Class
class MenuItem {
  // Update 5/26 Added the Stock for Inventory Management.
  constructor(id, name, price, desc, tags = [], stock = 99) {
    this.id = id;
    this.name = name;
    this.price = price;
    this.desc = desc;
    this.tags = tags;
    this.stock = stock; // New property for inventory management
  }
}

// Inherits from MenuItem
class FoodItem extends MenuItem {
  constructor(id, name, price, desc, tags = [], stock = 15) { // fixed default stock for food items
    super(id, name, price, desc, tags, stock); // Pass stock to super
  }
}

// Inherits from MenuItem, adds Drink-specific properties
// Modify the DrinkItem constructor to accept a tags array
// Update 5/26 
class DrinkItem extends MenuItem {
  constructor(id, name, price, desc, icon, tags = [], stock = 10) { // <-- Added tags and stock here
    super(id, name, price, desc, tags, stock); // <-- Pass tags and stock to super instead of []
    this.icon = icon;
  }
}

// Encapsulates a finalized order
class Order {
  constructor(items, prepTime) {
    this.items = items;
    this.timestamp = new Date();
    this.prepTime = prepTime;
  }
}

// Add to the bottom of models.js

// Encapsulates a physical table/seat in the cafe
class CafeTable {
  constructor(id, type, capacity) {
    this.id = id;
    this.type = type;         // 'small' (2-4), 'large' (6), or 'bar'
    this.capacity = capacity;
    this.isOccupied = false;
    this.occupiedSince = null; // Will store a Date object
  }

  occupy() {
    this.isOccupied = true;
    this.occupiedSince = new Date(); // Record current time
  }

  free() {
    this.isOccupied = false;
    this.occupiedSince = null;
  }

  // Helper to format the time it was occupied (e.g., "08:30 AM")
  getOccupiedTimeString() {
    if (!this.occupiedSince) return "";
    return this.occupiedSince.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}