#define FILTERSCRIPT

#include <open.mp>

public OnFilterScriptInit()
{
    printf(" ");
    printf("  -----------------------------------");
    printf("  |  {{name}} filterscript loaded! |");
    printf("  -----------------------------------");
    printf(" ");
    return true;
}

public OnFilterScriptExit()
{
    return true;
}

public OnPlayerConnect(playerid)
{
    return true;
}