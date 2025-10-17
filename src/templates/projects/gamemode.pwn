#include <open.mp>

main()
{
    printf(" ");
    printf("  -------------------------------");
    printf("  |  {{name}} gamemode initialized! |");
    printf("  -------------------------------");
    printf(" ");
}

public OnGameModeInit()
{
    SetGameModeText("{{name}}");
    AddPlayerClass(0, 2495.3547, -1688.2319, 13.6774, 351.1646, WEAPON_M4, 500, WEAPON_KNIFE, 1, WEAPON_COLT45, 100);
    AddStaticVehicle(522, 2493.7583, -1683.6482, 12.9099, 270.8069, -1, -1);
    return true;
}

public OnGameModeExit()
{
    return true;
}

public OnPlayerConnect(playerid)
{
    return true;
}

public OnPlayerDisconnect(playerid, reason)
{
    return true;
}

public OnPlayerRequestClass(playerid, classid)
{
    SetPlayerPos(playerid, 217.8511, -98.4865, 1005.2578);
    SetPlayerFacingAngle(playerid, 113.8861);
    SetPlayerInterior(playerid, 15);
    SetPlayerCameraPos(playerid, 215.2182, -99.5546, 1006.4);
    SetPlayerCameraLookAt(playerid, 217.8511, -98.4865, 1005.2578);
    ApplyAnimation(playerid, "benchpress", "gym_bp_celebrate", 4.1, true, false, false, false, 0, SYNC_NONE);
    return true;
}

public OnPlayerSpawn(playerid)
{
    SetPlayerInterior(playerid, 0);
    return true;
}

public OnPlayerDeath(playerid, killerid, WEAPON:reason)
{
    return true;
}