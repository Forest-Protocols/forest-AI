use crate::errors::{ForestError, ForestResult};

pub trait Validator<T> {
    fn validate(&self, value: &T) -> ForestResult<()>;
}

pub struct StringValidator {
    min_length: Option<usize>,
    max_length: Option<usize>,
    pattern: Option<regex::Regex>,
}

impl StringValidator {
    pub fn new() -> Self {
        Self {
            min_length: None,
            max_length: None,
            pattern: None,
        }
    }

    pub fn with_min_length(mut self, length: usize) -> Self {
        self.min_length = Some(length);
        self
    }

    pub fn with_max_length(mut self, length: usize) -> Self {
        self.max_length = Some(length);
        self
    }

    pub fn with_pattern(mut self, pattern: &str) -> Self {
        self.pattern = Some(regex::Regex::new(pattern).unwrap());
        self
    }
}

impl Validator<String> for StringValidator {
    fn validate(&self, value: &String) -> ForestResult<()> {
        if let Some(min) = self.min_length {
            if value.len() < min {
                return Err(ForestError::ValidationError(format!(
                    "String length must be at least {} characters",
                    min
                )));
            }
        }

        if let Some(max) = self.max_length {
            if value.len() > max {
                return Err(ForestError::ValidationError(format!(
                    "String length must be at most {} characters",
                    max
                )));
            }
        }

        if let Some(pattern) = &self.pattern {
            if !pattern.is_match(value) {
                return Err(ForestError::ValidationError(format!(
                    "String does not match pattern: {}",
                    pattern
                )));
            }
        }

        Ok(())
    }
}

pub struct NumberValidator<T> {
    min: Option<T>,
    max: Option<T>,
}

impl<T> NumberValidator<T> {
    pub fn new() -> Self {
        Self {
            min: None,
            max: None,
        }
    }

    pub fn with_min(mut self, value: T) -> Self {
        self.min = Some(value);
        self
    }

    pub fn with_max(mut self, value: T) -> Self {
        self.max = Some(value);
        self
    }
}

impl<T: PartialOrd + std::fmt::Display> Validator<T> for NumberValidator<T> {
    fn validate(&self, value: &T) -> ForestResult<()> {
        if let Some(min) = &self.min {
            if value < min {
                return Err(ForestError::ValidationError(format!(
                    "Value must be at least {}",
                    min
                )));
            }
        }

        if let Some(max) = &self.max {
            if value > max {
                return Err(ForestError::ValidationError(format!(
                    "Value must be at most {}",
                    max
                )));
            }
        }

        Ok(())
    }
}

pub struct ArrayValidator<T> {
    min_length: Option<usize>,
    max_length: Option<usize>,
    item_validator: Option<Box<dyn Validator<T>>>,
}

impl<T> ArrayValidator<T> {
    pub fn new() -> Self {
        Self {
            min_length: None,
            max_length: None,
            item_validator: None,
        }
    }

    pub fn with_min_length(mut self, length: usize) -> Self {
        self.min_length = Some(length);
        self
    }

    pub fn with_max_length(mut self, length: usize) -> Self {
        self.max_length = Some(length);
        self
    }

    pub fn with_item_validator<V: Validator<T> + 'static>(mut self, validator: V) -> Self {
        self.item_validator = Some(Box::new(validator));
        self
    }
}

impl<T> Validator<Vec<T>> for ArrayValidator<T> {
    fn validate(&self, value: &Vec<T>) -> ForestResult<()> {
        if let Some(min) = self.min_length {
            if value.len() < min {
                return Err(ForestError::ValidationError(format!(
                    "Array length must be at least {}",
                    min
                )));
            }
        }

        if let Some(max) = self.max_length {
            if value.len() > max {
                return Err(ForestError::ValidationError(format!(
                    "Array length must be at most {}",
                    max
                )));
            }
        }

        if let Some(validator) = &self.item_validator {
            for item in value {
                validator.validate(item)?;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_validator() {
        let validator = StringValidator::new()
            .with_min_length(3)
            .with_max_length(10)
            .with_pattern(r"^[a-z]+$");

        assert!(validator.validate(&"abc".to_string()).is_ok());
        assert!(validator.validate(&"ab".to_string()).is_err());
        assert!(validator.validate(&"abcdefghijk".to_string()).is_err());
        assert!(validator.validate(&"123".to_string()).is_err());
    }

    #[test]
    fn test_number_validator() {
        let validator = NumberValidator::new()
            .with_min(0)
            .with_max(100);

        assert!(validator.validate(&50).is_ok());
        assert!(validator.validate(&-1).is_err());
        assert!(validator.validate(&101).is_err());
    }

    #[test]
    fn test_array_validator() {
        let item_validator = NumberValidator::new()
            .with_min(0)
            .with_max(100);

        let validator = ArrayValidator::new()
            .with_min_length(2)
            .with_max_length(4)
            .with_item_validator(item_validator);

        assert!(validator.validate(&vec![1, 2, 3]).is_ok());
        assert!(validator.validate(&vec![1]).is_err());
        assert!(validator.validate(&vec![1, 2, 3, 4, 5]).is_err());
        assert!(validator.validate(&vec![1, -1, 3]).is_err());
    }
} 