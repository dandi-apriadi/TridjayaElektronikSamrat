# Spintax Processor Implementation

## Overview

The Spintax Processor is a component that enables message variation for blast campaigns by parsing and processing spintax templates. This helps avoid spam detection by ensuring each recipient receives a slightly different message.

## Features Implemented

### 1. Spintax Syntax Parsing (`{option1|option2|option3}`)
- Parses spintax groups with multiple options separated by `|`
- Randomly selects one option from each group during processing
- Example: `{Hello|Hi|Hey}` → randomly outputs "Hello", "Hi", or "Hey"

### 2. Nested Spintax Support (Max Depth 3)
- Supports nested spintax up to 3 levels deep
- Example: `{Hello {world|friend}|Hi there}` → "Hello world", "Hello friend", or "Hi there"
- Enforces max depth limit to prevent excessive nesting

### 3. Variable Replacement (`{{variable_name}}`)
- Replaces variables with actual values from a HashMap
- Example: `Hello {{name}}` with `name="John"` → "Hello John"
- Returns error if variable not found in context

### 4. Syntax Validation
- Validates spintax syntax before processing
- Detects and reports errors with position information:
  - Unclosed braces
  - Unmatched closing braces
  - Empty option groups
  - Empty variable names
  - Maximum depth exceeded

### 5. Parsed Tree Caching
- Caches parsed spintax trees for performance optimization
- Reuses cached parse results for repeated templates
- Provides `clear_cache()` method for cache management

### 6. Whitespace Preservation
- Preserves all whitespace and formatting in generated messages
- Maintains exact spacing from the original template

## API Usage

```rust
use tridjaya_backend::spintax::SpintaxProcessor;
use std::collections::HashMap;

// Create processor
let mut processor = SpintaxProcessor::new();

// Simple spintax
let template = "{Hello|Hi|Hey} there!";
let vars = HashMap::new();
let message = processor.process(template, &vars)?;

// With variables
let template = "Hello {{name}}, {how are you|what's up}?";
let mut vars = HashMap::new();
vars.insert("name".to_string(), "Alice".to_string());
let message = processor.process(template, &vars)?;

// Validate syntax
processor.validate("{Hello|Hi}")?;  // OK
processor.validate("{Hello|Hi")?;   // Error: unclosed brace
```

## Error Handling

The processor returns descriptive errors with position information:

```rust
pub enum SpintaxError {
    SyntaxError { position: usize, message: String },
    MaxDepthExceeded { position: usize, max_depth: usize },
    EmptyOptionGroup { position: usize },
    VariableNotFound { name: String },
}
```

## Test Coverage

15 comprehensive unit tests covering:
- Simple spintax parsing
- Nested spintax (depth 1-3)
- Variable replacement
- Combined spintax and variables
- Syntax error detection
- Empty option groups
- Max depth enforcement
- Variable not found errors
- Whitespace preservation
- Cache functionality
- Edge cases (empty variable names, unclosed braces, etc.)

All tests pass successfully.

## Requirements Satisfied

✅ **Requirement 4.1**: Parse spintax syntax `{option1|option2|option3}`
✅ **Requirement 4.2**: Randomly select one option from each group
✅ **Requirement 4.3**: Support nested spintax up to depth 3
✅ **Requirement 4.4**: Support variable replacement `{{variable_name}}`
✅ **Requirement 4.5**: Generate unique message variations
✅ **Requirement 4.6**: Return error with position for invalid syntax
✅ **Requirement 4.7**: Preserve whitespace and formatting
✅ **Requirement 4.8**: Cache parsed spintax tree for performance

## Integration with Blast Engine

The SpintaxProcessor is designed to be integrated into the Blast Engine:

1. **Campaign Creation**: Validate spintax syntax in campaign template
2. **Message Processing**: For each recipient, call `process()` with recipient variables
3. **Caching**: The processor automatically caches parsed templates for the campaign
4. **Error Handling**: Invalid syntax is caught during validation, not during sending

Example integration:

```rust
// In blast engine
let mut spintax = SpintaxProcessor::new();

// Validate campaign template
spintax.validate(&campaign.message_template)?;

// Process for each recipient
for recipient in recipients {
    let mut vars = HashMap::new();
    vars.insert("name".to_string(), recipient.name.clone());
    vars.insert("phone".to_string(), recipient.phone.clone());
    
    let message = spintax.process(&campaign.message_template, &vars)?;
    send_message(recipient.phone, message).await?;
}
```

## Performance Considerations

- **Caching**: Parsed templates are cached to avoid re-parsing for each recipient
- **Random Selection**: Uses `rand::thread_rng()` for efficient random selection
- **Memory**: Cache can be cleared with `clear_cache()` if memory is a concern
- **Complexity**: Parsing is O(n) where n is template length

## Dependencies Added

- `rand = "0.8"` - For random option selection

## Files Created

- `backend/src/spintax.rs` - Main implementation with tests
- `backend/src/spintax_example.rs` - Usage examples
- `backend/SPINTAX_IMPLEMENTATION.md` - This documentation

## Next Steps

The SpintaxProcessor is ready for integration into:
- Task 13: Blast Engine integration
- Task 24: Campaign config parser (spintax validation)
