"""
Structured Logger Utility
"""

import logging
import os
import sys


def get_logger(name: str) -> logging.Logger:
    """Get a configured logger instance."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level, logging.INFO))
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(getattr(logging, log_level, logging.INFO))
        
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    logger.propagate = False
    return logger
