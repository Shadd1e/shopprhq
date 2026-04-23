from num2words import num2words
import logging
logger = logging.getLogger(__name__)

def number_to_words(amount: float) -> str:
    # Converts number to words (e.g., 1500 -> "one thousand five hundred")
    # Handles decimals
    whole = int(amount)
    decimals = int(round((amount - whole) * 100))
    words = num2words(whole, lang="en")
    if decimals > 0:
        words += f" and {num2words(decimals)} cents"
    return words
