export function generateFilterscriptTemplate(name: string): string {
  return `#define FILTERSCRIPT
  
  #include <open.mp>
  
  public OnFilterScriptInit()
  {
      printf(" ");
      printf("  -----------------------------------");
      printf("  |  ${name} filterscript loaded! |");
      printf("  -----------------------------------");
      printf(" ");
      return 1;
  }
  
  public OnFilterScriptExit()
  {
      return 1;
  }
  
  public OnPlayerConnect(playerid)
  {
      return 1;
  }`;
}
