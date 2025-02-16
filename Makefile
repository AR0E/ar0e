
# Directories
MARKDOWN_DIR = markdowns
FUNCTIONALITY_DIR = functionality
PRODUCED_PAGES_DIR = produced_pages

# Template file
TEMPLATE = $(FUNCTIONALITY_DIR)/template.html

# Pandoc command
PANDOC = pandoc --template=$(TEMPLATE) -o

# Find all markdown files
MARKDOWN_FILES = $(wildcard $(MARKDOWN_DIR)/*.md)

# Generate corresponding HTML files in produced_pages
HTML_FILES = $(patsubst $(MARKDOWN_DIR)/%.md, $(PRODUCED_PAGES_DIR)/%.html, $(MARKDOWN_FILES))

# Default target
all: $(HTML_FILES)

# Rule to convert markdown to HTML
$(PRODUCED_PAGES_DIR)/%.html: $(MARKDOWN_DIR)/%.md
	$(PANDOC) $@ $<

# Clean up produced pages
clean:
	rm -f $(PRODUCED_PAGES_DIR)/*.html

.PHONY: all clean

check:
	@echo "No checks needed."

distcheck:
	@echo "No distcheck needed."