package main

import "net/http"

// ─────────────────────────────────────────────────────────────
// /help/<slug> handlers.
//
// Все страницы рендерятся из gocore/.../help_docs/<slug>.md
// через renderHelpDoc(slug) (//go:embed + goldmark).
//
// Источник истины — md файлы. Они же копируются в Hugo
// (scripts/sync-help.sh → content/ru/help/docs/) для GH Pages.
// Правка контента: только help_docs/*.md — оба фронта подхватят.
// ─────────────────────────────────────────────────────────────

func (s *apiServer) helpQuickstartHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("quickstart")
	helpRender(w, title, "quickstart", body)
}

func (s *apiServer) helpAPIHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("api")
	helpRender(w, title, "api", body)
}

func (s *apiServer) helpDebugHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("debug")
	helpRender(w, title, "debug", body)
}

func (s *apiServer) helpDOMHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("dom")
	helpRender(w, title, "dom", body)
}

func (s *apiServer) helpBrowserHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("browser")
	helpRender(w, title, "browser", body)
}

func (s *apiServer) helpNativeHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("native")
	helpRender(w, title, "native", body)
}

func (s *apiServer) helpArchitectureHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("architecture")
	helpRender(w, title, "architecture", body)
}

func (s *apiServer) helpBuildHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("build")
	helpRender(w, title, "build", body)
}

func (s *apiServer) helpTestsHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("tests")
	helpRender(w, title, "tests", body)
}

func (s *apiServer) helpFAQHandler(w http.ResponseWriter, r *http.Request) {
	title, body := renderHelpDoc("faq")
	helpRender(w, title, "faq", body)
}
