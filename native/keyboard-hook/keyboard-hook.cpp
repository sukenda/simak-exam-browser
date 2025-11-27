#include <windows.h>
#include <napi.h>

HHOOK g_hook = NULL;
Napi::FunctionReference g_callback;

// Low-level keyboard hook procedure
LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
    if (nCode >= 0) {
        KBDLLHOOKSTRUCT* pKeyboard = (KBDLLHOOKSTRUCT*)lParam;
        
        // ============================================
        // PRIORITY: BLOCK BARE WINDOWS KEY (HIGHEST PRIORITY)
        // ============================================
        // Block bare Windows key (Left & Right) - must be checked FIRST
        if (pKeyboard->vkCode == VK_LWIN || pKeyboard->vkCode == VK_RWIN) {
            return 1; // Block the key immediately
        }
        
        // Check if Windows key is currently pressed (for Win+key combinations)
        // This will be used later to catch-all remaining Win+key combinations
        BOOL hasWin = (GetAsyncKeyState(VK_LWIN) & 0x8000) || (GetAsyncKeyState(VK_RWIN) & 0x8000);
        
        // Block Alt+Tab
        if (pKeyboard->vkCode == VK_TAB && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
            return 1;
        }
        
        // Block Ctrl+Shift+Esc (Task Manager)
        if (pKeyboard->vkCode == VK_ESCAPE && 
            (GetAsyncKeyState(VK_CONTROL) & 0x8000) &&
            (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return 1;
        }
        
        // Block Alt+F4
        if (pKeyboard->vkCode == VK_F4 && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
            return 1;
        }
        
        // Block Win+X
        if ((pKeyboard->vkCode == 0x58 || pKeyboard->vkCode == VK_LWIN || pKeyboard->vkCode == VK_RWIN) &&
            (GetAsyncKeyState(VK_LWIN) & 0x8000 || GetAsyncKeyState(VK_RWIN) & 0x8000)) {
            // Additional check for Win+X combination
            return 1;
        }
        
        // Block Win+L (Lock screen)
        if (pKeyboard->vkCode == 0x4C && 
            (GetAsyncKeyState(VK_LWIN) & 0x8000 || GetAsyncKeyState(VK_RWIN) & 0x8000)) {
            return 1;
        }
        
        // Block Win+D (Show desktop)
        if (pKeyboard->vkCode == 0x44 && 
            (GetAsyncKeyState(VK_LWIN) & 0x8000 || GetAsyncKeyState(VK_RWIN) & 0x8000)) {
            return 1;
        }
        
        // Block Win+R (Run dialog)
        if (pKeyboard->vkCode == 0x52 && 
            (GetAsyncKeyState(VK_LWIN) & 0x8000 || GetAsyncKeyState(VK_RWIN) & 0x8000)) {
            return 1;
        }
        
        // Block F1-F12 (function keys) - termasuk dengan Fn key
        // VK_F1 = 0x70, VK_F2 = 0x71, ..., VK_F12 = 0x7B
        if (pKeyboard->vkCode >= 0x70 && pKeyboard->vkCode <= 0x7B) {
            return 1; // Block all function keys F1-F12
        }
        
        // ============================================
        // ALLOW ADMIN AND INFO SHORTCUTS
        // ============================================
        // Allow Ctrl+Alt+Shift+A (admin shortcut)
        // VK_A = 0x41
        if (pKeyboard->vkCode == 0x41 && 
            (GetAsyncKeyState(VK_CONTROL) & 0x8000) &&
            (GetAsyncKeyState(VK_MENU) & 0x8000) &&
            (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return CallNextHookEx(g_hook, nCode, wParam, lParam); // Allow
        }
        
        // Allow Ctrl+Shift+Alt+S (info shortcut)
        // VK_S = 0x53
        if (pKeyboard->vkCode == 0x53 && 
            (GetAsyncKeyState(VK_CONTROL) & 0x8000) &&
            (GetAsyncKeyState(VK_MENU) & 0x8000) &&
            (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return CallNextHookEx(g_hook, nCode, wParam, lParam); // Allow
        }
        
        // Block Ctrl + A sampai Z (0x41-0x5A)
        // BUT: Skip if Alt+Shift is also pressed (for admin/info shortcuts)
        BOOL hasCtrl = GetAsyncKeyState(VK_CONTROL) & 0x8000;
        BOOL hasAlt = GetAsyncKeyState(VK_MENU) & 0x8000;
        BOOL hasShift = GetAsyncKeyState(VK_SHIFT) & 0x8000;
        
        if (pKeyboard->vkCode >= 0x41 && pKeyboard->vkCode <= 0x5A && hasCtrl) {
            // Don't block if Alt+Shift is also pressed (admin/info shortcuts)
            if (hasAlt && hasShift) {
                return CallNextHookEx(g_hook, nCode, wParam, lParam); // Allow
            }
            return 1; // Block
        }
        
        // Block Ctrl + 1, 2, 5 (0x31, 0x32, 0x35)
        if ((pKeyboard->vkCode == 0x31 || pKeyboard->vkCode == 0x32 || pKeyboard->vkCode == 0x35) &&
            (GetAsyncKeyState(VK_CONTROL) & 0x8000)) {
            return 1;
        }
        
        // Block Ctrl + Esc
        if (pKeyboard->vkCode == VK_ESCAPE && (GetAsyncKeyState(VK_CONTROL) & 0x8000)) {
            return 1;
        }
        
        // Block Ctrl + F4
        if (pKeyboard->vkCode == VK_F4 && (GetAsyncKeyState(VK_CONTROL) & 0x8000)) {
            return 1;
        }
        
        // Block Ctrl + Tab
        if (pKeyboard->vkCode == VK_TAB && (GetAsyncKeyState(VK_CONTROL) & 0x8000)) {
            return 1;
        }
        
        // Block Ctrl + Shift + Tab
        if (pKeyboard->vkCode == VK_TAB && 
            (GetAsyncKeyState(VK_CONTROL) & 0x8000) &&
            (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return 1;
        }
        
        // Block Alt + Enter
        if (pKeyboard->vkCode == VK_RETURN && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
            return 1;
        }
        
        // Block Alt + Spacebar
        if (pKeyboard->vkCode == VK_SPACE && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
            return 1;
        }
        
        // Block Alt + Esc
        if (pKeyboard->vkCode == VK_ESCAPE && (GetAsyncKeyState(VK_MENU) & 0x8000)) {
            return 1;
        }
        
        // Block Shift + F10
        if (pKeyboard->vkCode == VK_F10 && (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return 1;
        }
        
        // Block Shift + Tab
        if (pKeyboard->vkCode == VK_TAB && (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return 1;
        }
        
        // Block Shift + Delete
        if (pKeyboard->vkCode == VK_DELETE && (GetAsyncKeyState(VK_SHIFT) & 0x8000)) {
            return 1;
        }
        
        // Block Ctrl + Arrow keys
        // VK_UP = 0x26, VK_DOWN = 0x28, VK_LEFT = 0x25, VK_RIGHT = 0x27
        if ((pKeyboard->vkCode == 0x26 || pKeyboard->vkCode == 0x28 || 
             pKeyboard->vkCode == 0x25 || pKeyboard->vkCode == 0x27) &&
            (GetAsyncKeyState(VK_CONTROL) & 0x8000)) {
            return 1;
        }
        
        // Block special keys: Enter, Tab, Delete, Backspace, Insert, Home, End, PageUp, PageDown, Arrow keys
        // VK_RETURN = 0x0D, VK_TAB = 0x09, VK_DELETE = 0x2E, VK_BACK = 0x08
        // VK_INSERT = 0x2D, VK_HOME = 0x24, VK_END = 0x23
        // VK_PRIOR = 0x21 (PageUp), VK_NEXT = 0x22 (PageDown)
        // Note: VK_BACK (Backspace) is ALLOWED - needed for text editing in forms
        if (pKeyboard->vkCode == VK_RETURN || pKeyboard->vkCode == VK_TAB ||
            pKeyboard->vkCode == VK_DELETE ||
            pKeyboard->vkCode == VK_INSERT || pKeyboard->vkCode == VK_HOME ||
            pKeyboard->vkCode == VK_END || pKeyboard->vkCode == 0x21 || // PageUp
            pKeyboard->vkCode == 0x22 || // PageDown
            pKeyboard->vkCode == 0x26 || // Up
            pKeyboard->vkCode == 0x28 || // Down
            pKeyboard->vkCode == 0x25 || // Left
            pKeyboard->vkCode == 0x27) { // Right
            // Only block if no modifier keys are pressed (or if modifier combination is blocked)
            BOOL hasCtrl = GetAsyncKeyState(VK_CONTROL) & 0x8000;
            BOOL hasAlt = GetAsyncKeyState(VK_MENU) & 0x8000;
            BOOL hasShift = GetAsyncKeyState(VK_SHIFT) & 0x8000;
            BOOL hasWin = (GetAsyncKeyState(VK_LWIN) & 0x8000) || (GetAsyncKeyState(VK_RWIN) & 0x8000);
            
            // Block if no modifiers, or if it's a blocked combination
            if (!hasCtrl && !hasAlt && !hasShift && !hasWin) {
                return 1;
            }
            // Block if it's a blocked combination (handled above)
        }
        
        // Block Alt key (bare) - VK_MENU = 0x12
        if (pKeyboard->vkCode == VK_MENU) {
            BOOL hasCtrl = GetAsyncKeyState(VK_CONTROL) & 0x8000;
            BOOL hasShift = GetAsyncKeyState(VK_SHIFT) & 0x8000;
            BOOL hasWin = (GetAsyncKeyState(VK_LWIN) & 0x8000) || (GetAsyncKeyState(VK_RWIN) & 0x8000);
            
            // Block bare Alt key (no other modifiers)
            if (!hasCtrl && !hasShift && !hasWin) {
                return 1;
            }
        }
        
        // Block Num Lock - VK_NUMLOCK = 0x90
        if (pKeyboard->vkCode == 0x90) {
            return 1;
        }
        
        // ============================================
        // CATCH-ALL: Block ALL remaining Win+key combinations
        // ============================================
        // This catches any Win+key combination that wasn't explicitly handled above
        // Examples: Win+A, Win+B, Win+C, Win+E, Win+F, Win+G, Win+H, Win+I, Win+J, Win+K, Win+M, Win+N, Win+O, Win+P, Win+Q, Win+S, Win+T, Win+U, Win+V, Win+W, Win+Y, Win+Z, Win+1, Win+2, Win+3, etc.
        if (hasWin) {
            return 1; // Block all Win+key combinations that weren't caught above
        }
    }
    return CallNextHookEx(g_hook, nCode, wParam, lParam);
}

// Install the keyboard hook
Napi::Value InstallHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (g_hook != NULL) {
        return Napi::Boolean::New(env, false); // Already installed
    }
    
    g_hook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc, 
                              GetModuleHandle(NULL), 0);
    
    if (g_hook == NULL) {
        return Napi::Boolean::New(env, false);
    }
    
    return Napi::Boolean::New(env, true);
}

// Uninstall the keyboard hook
Napi::Value UninstallHook(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (g_hook == NULL) {
        return Napi::Boolean::New(env, false); // Not installed
    }
    
    BOOL result = UnhookWindowsHookEx(g_hook);
    g_hook = NULL;
    
    return Napi::Boolean::New(env, result != 0);
}

// Check if hook is installed
Napi::Value IsInstalled(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, g_hook != NULL);
}

// Initialize the module
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "installHook"),
                Napi::Function::New(env, InstallHook));
    exports.Set(Napi::String::New(env, "uninstallHook"),
                Napi::Function::New(env, UninstallHook));
    exports.Set(Napi::String::New(env, "isInstalled"),
                Napi::Function::New(env, IsInstalled));
    return exports;
}

NODE_API_MODULE(keyboard_hook, Init)

