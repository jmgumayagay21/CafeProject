import sqlite3

# Connect to the database
def get_db_connection():
    conn = sqlite3.connect('cafe_roo.db')
    conn.row_factory = sqlite3.Row
    return conn

# Function to process an order and deduct inventory
def process_order(cart_items):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Step 1: Start a transaction
        cursor.execute("BEGIN TRANSACTION")
        
        for item_id, quantity_ordered in cart_items.items():
            # Check current stock
            cursor.execute("SELECT stock_quantity, name FROM inventory WHERE item_id = ?", (item_id,))
            item = cursor.fetchone()
            
            if not item:
                raise Exception(f"Item {item_id} not found in database.")
                
            current_stock = item['stock_quantity']
            
            # Step 2: Validate inventory
            if current_stock < quantity_ordered:
                raise Exception(f"Not enough stock for {item['name']}. Only {current_stock} left.")
                
            # Step 3: Deduct the inventory
            cursor.execute(
                "UPDATE inventory SET stock_quantity = stock_quantity - ? WHERE item_id = ?",
                (quantity_ordered, item_id)
            )
            
        # Step 4: Commit the changes if everything is successful
        conn.commit()
        print("Order placed successfully! Inventory updated.")
        return True
        
    except Exception as e:
        # If anything fails (like low stock), rollback the whole order
        conn.rollback()
        print(f"Order failed: {e}")
        return False
        
    finally:
        conn.close()

# Example usage from your frontend Cart data:
# The user ordered 2 Espressos and 1 Matcha Latte
incoming_order = {
    'd1': 2, 
    'd5': 1  
}

process_order(incoming_order)