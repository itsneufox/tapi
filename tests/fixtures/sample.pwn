#include <a_samp>

main() {
    print("Sample gamemode loaded!");
    printf("Max players: %d", MAX_PLAYERS);
    
    #if DEBUG
    print("Debug mode enabled");
    #endif
}

public OnGameModeInit() {
    SetGameModeText("Sample Gamemode");
    return 1;
}

public OnPlayerConnect(playerid) {
    new msg[128];
    format(msg, sizeof(msg), "Player %d connected", playerid);
    print(msg);
    return 1;
}
