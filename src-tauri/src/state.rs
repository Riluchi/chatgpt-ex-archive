use std::path::{Path, PathBuf};

use crate::{
    db::{connection::open_database, migrations::run_migrations},
    error::AppResult,
};

#[derive(Debug, Clone)]
pub struct AppState {
    db_path: PathBuf,
}

impl AppState {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn initialize(&self) -> AppResult<()> {
        let connection = open_database(&self.db_path)?;
        run_migrations(&connection)?;
        Ok(())
    }
}
