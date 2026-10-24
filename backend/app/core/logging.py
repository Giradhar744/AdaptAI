import logging
import sys
from app.core.config import settings


def setup_logging() -> logging.Logger:
    """Configures privacy-aware logging for the AdaptAI platform.
    
    Rule (PROJECT.md §0.2 rule 9 & §14.2):
    Never log raw student answers, student free-text responses, or disability
    types at INFO level or above.
    """
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger("adaptai")
    root_logger.setLevel(log_level)
    
    # Avoid duplicate handlers on re-import
    if not root_logger.handlers:
        root_logger.addHandler(handler)

    return root_logger


logger = setup_logging()
