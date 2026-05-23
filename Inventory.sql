-- Create an Inventory Table
CREATE TABLE inventory (
    item_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10, 2),
    stock_quantity INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert some starter data
INSERT INTO inventory (item_id, name, category, price, stock_quantity) VALUES 
('d1', 'Espresso', 'drinks', 115.00, 50),
('d4', 'Iced Latte', 'drinks', 175.00, 30),
('d5', 'Matcha Latte', 'drinks', 185.00, 15); -- Only 15 matcha portions left!