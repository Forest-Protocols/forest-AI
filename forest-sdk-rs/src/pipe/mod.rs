use std::future::Future;
use std::pin::Pin;

use crate::errors::{ForestError, ForestResult};

pub mod rest;

pub trait Pipe<T> {
    fn process(&self, input: T) -> Pin<Box<dyn Future<Output = ForestResult<T>> + Send>>;
}

pub struct Pipeline<T> {
    pipes: Vec<Box<dyn Pipe<T>>>,
}

impl<T> Pipeline<T> {
    pub fn new() -> Self {
        Self {
            pipes: Vec::new(),
        }
    }

    pub fn add_pipe<P: Pipe<T> + 'static>(&mut self, pipe: P) {
        self.pipes.push(Box::new(pipe));
    }

    pub async fn execute(&self, input: T) -> ForestResult<T> {
        let mut result = input;
        for pipe in &self.pipes {
            result = pipe.process(result).await?;
        }
        Ok(result)
    }
}

pub struct ValidationPipe<T> {
    validator: Box<dyn Fn(&T) -> ForestResult<()>>,
}

impl<T> ValidationPipe<T> {
    pub fn new<F>(validator: F) -> Self
    where
        F: Fn(&T) -> ForestResult<()> + 'static,
    {
        Self {
            validator: Box::new(validator),
        }
    }
}

impl<T> Pipe<T> for ValidationPipe<T> {
    fn process(&self, input: T) -> Pin<Box<dyn Future<Output = ForestResult<T>> + Send>> {
        let validator = &self.validator;
        Box::pin(async move {
            validator(&input)?;
            Ok(input)
        })
    }
}

pub struct TransformPipe<T, U> {
    transformer: Box<dyn Fn(T) -> ForestResult<U>>,
}

impl<T, U> TransformPipe<T, U> {
    pub fn new<F>(transformer: F) -> Self
    where
        F: Fn(T) -> ForestResult<U> + 'static,
    {
        Self {
            transformer: Box::new(transformer),
        }
    }
}

impl<T, U> Pipe<T> for TransformPipe<T, U> {
    fn process(&self, input: T) -> Pin<Box<dyn Future<Output = ForestResult<U>> + Send>> {
        let transformer = &self.transformer;
        Box::pin(async move {
            transformer(input)
        })
    }
}

pub struct AsyncTransformPipe<T, U> {
    transformer: Box<dyn Fn(T) -> Pin<Box<dyn Future<Output = ForestResult<U>> + Send>>>,
}

impl<T, U> AsyncTransformPipe<T, U> {
    pub fn new<F, Fut>(transformer: F) -> Self
    where
        F: Fn(T) -> Fut + 'static,
        Fut: Future<Output = ForestResult<U>> + Send + 'static,
    {
        Self {
            transformer: Box::new(move |input| Box::pin(transformer(input))),
        }
    }
}

impl<T, U> Pipe<T> for AsyncTransformPipe<T, U> {
    fn process(&self, input: T) -> Pin<Box<dyn Future<Output = ForestResult<U>> + Send>> {
        let transformer = &self.transformer;
        transformer(input)
    }
}

pub use rest::{RestPipe, RestPipeConfig, JwtClaims};

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validation_pipe() {
        let validator = |x: &i32| {
            if *x > 0 {
                Ok(())
            } else {
                Err(ForestError::ValidationError("Value must be positive".to_string()))
            }
        };

        let pipe = ValidationPipe::new(validator);
        assert!(pipe.process(1).await.is_ok());
        assert!(pipe.process(-1).await.is_err());
    }

    #[tokio::test]
    async fn test_transform_pipe() {
        let transformer = |x: i32| Ok(x.to_string());
        let pipe = TransformPipe::new(transformer);
        let result = pipe.process(42).await.unwrap();
        assert_eq!(result, "42");
    }

    #[tokio::test]
    async fn test_pipeline() {
        let mut pipeline = Pipeline::new();
        
        // Add validation pipe
        let validator = |x: &i32| {
            if *x > 0 {
                Ok(())
            } else {
                Err(ForestError::ValidationError("Value must be positive".to_string()))
            }
        };
        pipeline.add_pipe(ValidationPipe::new(validator));

        // Add transform pipe
        let transformer = |x: i32| Ok(x.to_string());
        pipeline.add_pipe(TransformPipe::new(transformer));

        let result = pipeline.execute(42).await.unwrap();
        assert_eq!(result, "42");
    }
} 