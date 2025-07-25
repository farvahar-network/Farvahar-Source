#include <windows.h>
#include <fstream>
#include <string>
#include <codecvt>
#include <locale>

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPWSTR lpCmdLine, int nCmdShow) {
    std::wstring errorMessage = lpCmdLine;

    MessageBoxW(NULL, errorMessage.c_str(), L"Farvahar - Xray Error", MB_ICONERROR | MB_OK);

    std::wofstream log("farvahar_error.log", std::ios::app);
    if (log.is_open()) {
        log << L"[Error] " << errorMessage << std::endl;
        log.close();
    }

    return 0;
}
