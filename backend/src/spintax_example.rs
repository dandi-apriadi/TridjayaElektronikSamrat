// Example usage of SpintaxProcessor
// This file demonstrates how to use the spintax processor in the blast engine

use crate::spintax::SpintaxProcessor;
use std::collections::HashMap;

#[allow(dead_code)]
pub fn example_usage() {
    let mut processor = SpintaxProcessor::new();
    
    // Example 1: Simple spintax
    let template1 = "{Hello|Hi|Hey} there!";
    let vars = HashMap::new();
    match processor.process(template1, &vars) {
        Ok(msg) => println!("Generated: {}", msg),
        Err(e) => println!("Error: {}", e),
    }
    
    // Example 2: Nested spintax
    let template2 = "{Hello {world|friend}|Hi there|Hey {buddy|pal}}!";
    match processor.process(template2, &vars) {
        Ok(msg) => println!("Generated: {}", msg),
        Err(e) => println!("Error: {}", e),
    }
    
    // Example 3: Variable replacement
    let template3 = "Hello {{name}}, your order {{order_id}} is ready!";
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), "John".to_string());
    vars.insert("order_id".to_string(), "#12345".to_string());
    match processor.process(template3, &vars) {
        Ok(msg) => println!("Generated: {}", msg),
        Err(e) => println!("Error: {}", e),
    }
    
    // Example 4: Combined spintax and variables
    let template4 = "{Hello|Hi} {{name}}, {how are you|what's up}? Your balance is {{balance}}.";
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), "Alice".to_string());
    vars.insert("balance".to_string(), "$100".to_string());
    match processor.process(template4, &vars) {
        Ok(msg) => println!("Generated: {}", msg),
        Err(e) => println!("Error: {}", e),
    }
    
    // Example 5: Validation before processing
    let template5 = "{Hello|Hi";  // Invalid: unclosed brace
    match processor.validate(template5) {
        Ok(_) => println!("Template is valid"),
        Err(e) => println!("Validation error: {}", e),
    }
}

#[allow(dead_code)]
pub fn blast_campaign_example() {
    let mut processor = SpintaxProcessor::new();
    
    // Campaign template with spintax
    let campaign_template = "{Hi|Hello|Hey} {{name}}, \
        {we have|check out} {an amazing|a special|an exclusive} offer for you! \
        {Visit|Check} our store {today|now|right away}!";
    
    // Simulate processing for multiple recipients
    let recipients = vec![
        ("John", "+1234567890"),
        ("Alice", "+1234567891"),
        ("Bob", "+1234567892"),
    ];
    
    println!("\n=== Blast Campaign Example ===");
    for (name, phone) in recipients {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), name.to_string());
        
        match processor.process(campaign_template, &vars) {
            Ok(msg) => println!("To {}: {}", phone, msg),
            Err(e) => println!("Error for {}: {}", phone, e),
        }
    }
}
