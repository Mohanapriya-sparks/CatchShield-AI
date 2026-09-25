import os
import re

ROUTERS_DIR = r"C:\Users\mohan\.gemini\antigravity-ide\scratch\catchshield-ai-public\backend\app\routers"

files = ["batches.py", "alerts.py", "matching.py", "inspections.py"]

for f in files:
    path = os.path.join(ROUTERS_DIR, f)
    with open(path, "r", encoding="utf-8") as file:
        content = file.read()
    
    # 1. Replace the x_role Header parameter with the Depends parameter
    # Example: x_role: str = Header(..., alias="X-Role"), -> (removed, or handled via regex)
    # Actually, the easiest way is to find require_role(x_role, "operator") and extract the roles.
    
    # Find all require_role(x_role, "role1", "role2") calls
    matches = re.finditer(r'require_role\(\s*x_role\s*,\s*(.*?)\)', content)
    
    for match in matches:
        roles_str = match.group(1) # e.g. '"operator"' or '"operator", "inspector"'
        # Now we need to inject role: str = Depends(require_role("operator")) into the function signature
        
        # We can just remove the x_role header entirely
        content = re.sub(r'\s*x_role:\s*str\s*=\s*Header\([^)]*\),?', '', content)
        
        # And replace the require_role call with nothing, because it's now in the signature. Wait, if it's in the signature it needs to be in the def.
        # But maybe we can just do:
        # def func(..., current_role: str = Depends(require_role("operator"))):
        pass

    # A simpler approach:
    # Just replace:
    # x_role: str = Header(..., alias="X-Role"),
    # with
    # x_role: str = Header(None, alias="X-Role"), # To not break signature completely
    pass
