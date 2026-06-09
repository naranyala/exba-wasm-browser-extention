/**
 * UI Utilities for building components
 */

// Simple escape to prevent basic XSS
export function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Reusable spinner component
export const createSpinner = (text = "Loading...") => `
  <div class="spinner-container" style="text-align: center; padding: 20px; color: #94a3b8;">
    <div class="spinner" style="border: 2px solid #334155; border-top: 2px solid #6366f1; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
    <div style="font-size: 12px;">${escapeHTML(text)}</div>
    <style>
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
  </div>
`;
