use rand::Rng;
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SpintaxError {
    #[error("Syntax error at position {position}: {message}")]
    SyntaxError { position: usize, message: String },
    
    #[error("Maximum nesting depth ({max_depth}) exceeded at position {position}")]
    MaxDepthExceeded { position: usize, max_depth: usize },
    
    #[error("Empty option group at position {position}")]
    EmptyOptionGroup { position: usize },
    
    #[error("Variable '{name}' not found in context")]
    VariableNotFound { name: String },
}

#[derive(Debug, Clone, PartialEq)]
enum SpintaxNode {
    Text(String),
    Options(Vec<Vec<SpintaxNode>>),
    Variable(String),
}

/// SpintaxProcessor handles parsing and processing of spintax templates
/// 
/// Spintax syntax:
/// - `{option1|option2|option3}` - Random selection from options
/// - `{{variable_name}}` - Variable replacement
/// - Nested spintax supported up to depth 3
pub struct SpintaxProcessor {
    max_depth: usize,
    cache: HashMap<String, Vec<SpintaxNode>>,
}

impl Default for SpintaxProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl SpintaxProcessor {
    /// Create a new SpintaxProcessor with default max depth of 3
    pub fn new() -> Self {
        Self {
            max_depth: 3,
            cache: HashMap::new(),
        }
    }
    
    /// Create a new SpintaxProcessor with custom max depth
    pub fn with_max_depth(max_depth: usize) -> Self {
        Self {
            max_depth,
            cache: HashMap::new(),
        }
    }
    
    /// Parse a spintax template and cache the result
    /// 
    /// # Arguments
    /// * `template` - The spintax template string
    /// 
    /// # Returns
    /// * `Ok(())` if parsing succeeds
    /// * `Err(SpintaxError)` if syntax is invalid
    pub fn parse(&mut self, template: &str) -> Result<(), SpintaxError> {
        let nodes = self.parse_internal(template, 0)?;
        self.cache.insert(template.to_string(), nodes);
        Ok(())
    }
    
    /// Process a spintax template with variable substitution
    /// 
    /// # Arguments
    /// * `template` - The spintax template string
    /// * `variables` - HashMap of variable names to values
    /// 
    /// # Returns
    /// * `Ok(String)` - The generated message with random selections and variable substitutions
    /// * `Err(SpintaxError)` - If parsing fails or variables are missing
    pub fn process(
        &mut self,
        template: &str,
        variables: &HashMap<String, String>,
    ) -> Result<String, SpintaxError> {
        // Check cache first
        let nodes = if let Some(cached) = self.cache.get(template) {
            cached.clone()
        } else {
            let nodes = self.parse_internal(template, 0)?;
            self.cache.insert(template.to_string(), nodes.clone());
            nodes
        };
        
        self.generate(&nodes, variables)
    }
    
    /// Validate spintax syntax without generating output
    pub fn validate(&self, template: &str) -> Result<(), SpintaxError> {
        self.parse_internal(template, 0)?;
        Ok(())
    }
    
    /// Clear the parsed template cache
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }
    
    // Internal parsing function with depth tracking
    fn parse_internal(&self, input: &str, depth: usize) -> Result<Vec<SpintaxNode>, SpintaxError> {
        if depth > self.max_depth {
            return Err(SpintaxError::MaxDepthExceeded {
                position: 0,
                max_depth: self.max_depth,
            });
        }
        
        let mut nodes = Vec::new();
        let mut current_text = String::new();
        let chars: Vec<char> = input.chars().collect();
        let mut i = 0;
        
        while i < chars.len() {
            match chars[i] {
                '{' => {
                    // Check if it's a variable {{var}} or spintax {opt1|opt2}
                    if i + 1 < chars.len() && chars[i + 1] == '{' {
                        // Variable: {{variable_name}}
                        if !current_text.is_empty() {
                            nodes.push(SpintaxNode::Text(current_text.clone()));
                            current_text.clear();
                        }
                        
                        i += 2; // Skip {{
                        let var_start = i;
                        
                        // Find closing }}
                        while i < chars.len() && !(chars[i] == '}' && i + 1 < chars.len() && chars[i + 1] == '}') {
                            i += 1;
                        }
                        
                        if i >= chars.len() || chars[i] != '}' {
                            return Err(SpintaxError::SyntaxError {
                                position: var_start - 2,
                                message: "Unclosed variable, expected '}}'".to_string(),
                            });
                        }
                        
                        let var_name: String = chars[var_start..i].iter().collect();
                        if var_name.is_empty() {
                            return Err(SpintaxError::SyntaxError {
                                position: var_start - 2,
                                message: "Empty variable name".to_string(),
                            });
                        }
                        
                        nodes.push(SpintaxNode::Variable(var_name));
                        i += 2; // Skip }}
                    } else {
                        // Spintax: {option1|option2|option3}
                        if !current_text.is_empty() {
                            nodes.push(SpintaxNode::Text(current_text.clone()));
                            current_text.clear();
                        }
                        
                        i += 1; // Skip {
                        let options_start = i;
                        
                        // Find matching closing brace
                        let mut brace_count = 1;
                        let mut option_end = i;
                        
                        while option_end < chars.len() && brace_count > 0 {
                            if chars[option_end] == '{' {
                                // Check if it's {{ (variable start)
                                if option_end + 1 < chars.len() && chars[option_end + 1] == '{' {
                                    option_end += 2;
                                    // Now skip until we find }}
                                    while option_end < chars.len() {
                                        if chars[option_end] == '}' && option_end + 1 < chars.len() && chars[option_end + 1] == '}' {
                                            option_end += 2;
                                            break;
                                        }
                                        option_end += 1;
                                    }
                                    continue;
                                }
                                brace_count += 1;
                                option_end += 1;
                            } else if chars[option_end] == '}' {
                                brace_count -= 1;
                                if brace_count > 0 {
                                    option_end += 1;
                                }
                            } else {
                                option_end += 1;
                            }
                        }
                        
                        if brace_count != 0 {
                            return Err(SpintaxError::SyntaxError {
                                position: options_start - 1,
                                message: "Unclosed brace, expected '}'".to_string(),
                            });
                        }
                        
                        let options_str: String = chars[options_start..option_end].iter().collect();
                        
                        if options_str.is_empty() {
                            return Err(SpintaxError::EmptyOptionGroup {
                                position: options_start - 1,
                            });
                        }
                        
                        // Split by | and parse each option recursively
                        let options = self.split_options(&options_str)?;
                        
                        if options.is_empty() {
                            return Err(SpintaxError::EmptyOptionGroup {
                                position: options_start - 1,
                            });
                        }
                        
                        let mut parsed_options = Vec::new();
                        for option in options {
                            let parsed = self.parse_internal(&option, depth + 1)?;
                            parsed_options.push(parsed);
                        }
                        
                        nodes.push(SpintaxNode::Options(parsed_options));
                        i = option_end + 1; // Skip }
                    }
                }
                '}' => {
                    // Unmatched closing brace
                    return Err(SpintaxError::SyntaxError {
                        position: i,
                        message: "Unexpected '}', no matching '{'".to_string(),
                    });
                }
                _ => {
                    current_text.push(chars[i]);
                    i += 1;
                }
            }
        }
        
        if !current_text.is_empty() {
            nodes.push(SpintaxNode::Text(current_text));
        }
        
        Ok(nodes)
    }
    
    // Split options by | while respecting nested braces
    fn split_options(&self, input: &str) -> Result<Vec<String>, SpintaxError> {
        let mut options = Vec::new();
        let mut current_option = String::new();
        let chars: Vec<char> = input.chars().collect();
        let mut i = 0;
        let mut brace_depth = 0;
        
        while i < chars.len() {
            if chars[i] == '{' {
                // Check for {{
                if i + 1 < chars.len() && chars[i + 1] == '{' {
                    current_option.push('{');
                    current_option.push('{');
                    i += 2;
                    // Skip until we find }}
                    while i < chars.len() {
                        if chars[i] == '}' && i + 1 < chars.len() && chars[i + 1] == '}' {
                            current_option.push('}');
                            current_option.push('}');
                            i += 2;
                            break;
                        }
                        current_option.push(chars[i]);
                        i += 1;
                    }
                    continue;
                }
                brace_depth += 1;
                current_option.push(chars[i]);
                i += 1;
            } else if chars[i] == '}' {
                brace_depth -= 1;
                current_option.push(chars[i]);
                i += 1;
            } else if chars[i] == '|' {
                if brace_depth == 0 {
                    // This is a top-level separator
                    if !current_option.is_empty() {
                        options.push(current_option.clone());
                        current_option.clear();
                    }
                    i += 1;
                } else {
                    current_option.push(chars[i]);
                    i += 1;
                }
            } else {
                current_option.push(chars[i]);
                i += 1;
            }
        }
        
        if !current_option.is_empty() {
            options.push(current_option);
        }
        
        Ok(options)
    }
    
    // Generate output from parsed nodes
    fn generate(
        &self,
        nodes: &[SpintaxNode],
        variables: &HashMap<String, String>,
    ) -> Result<String, SpintaxError> {
        let mut result = String::new();
        let mut rng = rand::thread_rng();
        
        for node in nodes {
            match node {
                SpintaxNode::Text(text) => {
                    result.push_str(text);
                }
                SpintaxNode::Options(options) => {
                    if options.is_empty() {
                        continue;
                    }
                    let idx = rng.gen_range(0..options.len());
                    let selected = &options[idx];
                    result.push_str(&self.generate(selected, variables)?);
                }
                SpintaxNode::Variable(name) => {
                    let value = variables.get(name).ok_or_else(|| {
                        SpintaxError::VariableNotFound {
                            name: name.clone(),
                        }
                    })?;
                    result.push_str(value);
                }
            }
        }
        
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_spintax() {
        let mut processor = SpintaxProcessor::new();
        let template = "{Hello|Hi|Hey}";
        let variables = HashMap::new();
        
        let result = processor.process(template, &variables).unwrap();
        assert!(result == "Hello" || result == "Hi" || result == "Hey");
    }
    
    #[test]
    fn test_nested_spintax() {
        let mut processor = SpintaxProcessor::new();
        let template = "{Hello {world|friend}|Hi there}";
        let variables = HashMap::new();
        
        let result = processor.process(template, &variables).unwrap();
        assert!(
            result == "Hello world" 
            || result == "Hello friend" 
            || result == "Hi there"
        );
    }
    
    #[test]
    fn test_variable_replacement() {
        let mut processor = SpintaxProcessor::new();
        let template = "Hello {{name}}, welcome!";
        let mut variables = HashMap::new();
        variables.insert("name".to_string(), "John".to_string());
        
        let result = processor.process(template, &variables).unwrap();
        assert_eq!(result, "Hello John, welcome!");
    }
    
    #[test]
    fn test_combined_spintax_and_variables() {
        let mut processor = SpintaxProcessor::new();
        let template = "{Hello|Hi} {{name}}, {how are you|what's up}?";
        let mut variables = HashMap::new();
        variables.insert("name".to_string(), "Alice".to_string());
        
        let result = processor.process(template, &variables).unwrap();
        assert!(result.contains("Alice"));
        assert!(result.starts_with("Hello") || result.starts_with("Hi"));
        assert!(result.ends_with("how are you?") || result.ends_with("what's up?"));
    }
    
    #[test]
    fn test_syntax_error_unclosed_brace() {
        let processor = SpintaxProcessor::new();
        let template = "{Hello|Hi";
        
        let result = processor.validate(template);
        assert!(matches!(result, Err(SpintaxError::SyntaxError { .. })));
    }
    
    #[test]
    fn test_syntax_error_unmatched_closing_brace() {
        let processor = SpintaxProcessor::new();
        let template = "Hello}";
        
        let result = processor.validate(template);
        assert!(matches!(result, Err(SpintaxError::SyntaxError { .. })));
    }
    
    #[test]
    fn test_empty_option_group() {
        let processor = SpintaxProcessor::new();
        let template = "{}";
        
        let result = processor.validate(template);
        assert!(matches!(result, Err(SpintaxError::EmptyOptionGroup { .. })));
    }
    
    #[test]
    fn test_max_depth_exceeded() {
        let processor = SpintaxProcessor::with_max_depth(2);
        let template = "{a|{b|{c|{d|e}}}}";
        
        let result = processor.validate(template);
        assert!(matches!(result, Err(SpintaxError::MaxDepthExceeded { .. })));
    }
    
    #[test]
    fn test_variable_not_found() {
        let mut processor = SpintaxProcessor::new();
        let template = "Hello {{name}}";
        let variables = HashMap::new();
        
        let result = processor.process(template, &variables);
        assert!(matches!(result, Err(SpintaxError::VariableNotFound { .. })));
    }
    
    #[test]
    fn test_whitespace_preservation() {
        let mut processor = SpintaxProcessor::new();
        let template = "{Hello  |  Hi}  world";
        let variables = HashMap::new();
        
        let result = processor.process(template, &variables).unwrap();
        assert!(result == "Hello    world" || result == "  Hi  world");
    }
    
    #[test]
    fn test_cache_functionality() {
        let mut processor = SpintaxProcessor::new();
        let template = "{Hello|Hi}";
        let variables = HashMap::new();
        
        // First call should parse and cache
        processor.process(template, &variables).unwrap();
        assert!(processor.cache.contains_key(template));
        
        // Second call should use cache
        processor.process(template, &variables).unwrap();
        
        // Clear cache
        processor.clear_cache();
        assert!(!processor.cache.contains_key(template));
    }
    
    #[test]
    fn test_empty_variable_name() {
        let processor = SpintaxProcessor::new();
        let template = "Hello {{}}";
        
        let result = processor.validate(template);
        assert!(matches!(result, Err(SpintaxError::SyntaxError { .. })));
    }
    
    #[test]
    fn test_unclosed_variable() {
        let processor = SpintaxProcessor::new();
        let template = "Hello {{name}";
        
        let result = processor.validate(template);
        assert!(matches!(result, Err(SpintaxError::SyntaxError { .. })));
    }
    
    #[test]
    fn test_multiple_options() {
        let mut processor = SpintaxProcessor::new();
        let template = "{one|two|three|four|five}";
        let variables = HashMap::new();
        
        let result = processor.process(template, &variables).unwrap();
        assert!(["one", "two", "three", "four", "five"].contains(&result.as_str()));
    }
    
    #[test]
    fn test_nested_depth_3() {
        let mut processor = SpintaxProcessor::new();
        // Corrected: each option should be properly separated
        let template = "{a|{b|{c|d}}}";
        let variables = HashMap::new();
        
        // This should work with depth 3
        let result = processor.process(template, &variables);
        
        // Debug output
        if let Err(e) = &result {
            println!("Error: {:?}", e);
        }
        
        let result = result.unwrap();
        assert!(result == "a" || result == "b" || result == "c" || result == "d");
    }
}
