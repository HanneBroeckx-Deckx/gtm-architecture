.DEFAULT_GOAL := help
NODE ?= node

.PHONY: help validate types schemas links check

help: ## Show this help
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'

validate: ## Validate the tracking plan
	@$(NODE) tooling/validate.mjs

types: ## Generate TypeScript types from the plan
	@$(NODE) tooling/generate-types.mjs

schemas: ## Parse every JSON Schema
	@for f in data-layer/*.json tooling/schemas/*.json; do \
		$(NODE) -e "JSON.parse(require('fs').readFileSync('$$f','utf8'))" && echo "ok   $$f" || exit 1; \
	done

links: ## Resolve every relative markdown link
	@$(NODE) tooling/check-links.mjs

check: validate schemas links ## Everything CI runs
	@echo "\033[32mall checks passed\033[0m"
