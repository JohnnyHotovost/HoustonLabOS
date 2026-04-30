"""Seed predefined templates and demo data for HoustonLab OS."""
from datetime import datetime, timezone, timedelta
import os
import random

from auth import hash_password
from models import now_iso, new_id


def _field(key, label, type_, **kw):
    base = {"key": key, "label": label, "type": type_, "required": False, "options": [], "placeholder": None}
    base.update(kw)
    return base


PREDEFINED_TEMPLATES = [
    {
        "name": "Custom PC Build",
        "category": "Custom PC Build",
        "description": "Full-spec custom PC build with assembly, testing and benchmarks.",
        "supports_secrets": False,
        "fields": [
            _field("cpu", "CPU", "text"),
            _field("gpu", "GPU", "text"),
            _field("motherboard", "Motherboard", "text"),
            _field("ram", "RAM", "text"),
            _field("storage", "Storage", "text"),
            _field("psu", "Power Supply", "text"),
            _field("case", "Case", "text"),
            _field("cooling", "Cooling", "text"),
            _field("fans", "Fans", "text"),
            _field("os", "Operating System", "text"),
            _field("bios_version", "BIOS Version", "text"),
            _field("xmp_enabled", "XMP/EXPO Enabled", "checkbox"),
            _field("benchmark_results", "Benchmark Results", "textarea"),
            _field("temperature_notes", "Temperature Notes", "textarea"),
            _field("cable_management_notes", "Cable Management Notes", "textarea"),
            _field("final_config_notes", "Final Configuration Notes", "textarea"),
        ],
        "checklist": [
            "Inspect all components", "Install CPU", "Install RAM", "Install M.2 SSD",
            "Install motherboard", "Install PSU", "Connect front panel", "Connect storage",
            "Cable management", "BIOS update", "Enable XMP/EXPO", "Install operating system",
            "Install drivers", "Stress test", "Benchmark", "Check temperatures",
            "Take final photos", "Final handover",
        ],
        "attachment_categories": ["Component photos", "Build progress", "Cable management", "Benchmarks", "Final photos", "Invoices"],
    },
    {
        "name": "PC Repair",
        "category": "PC Repair",
        "description": "Diagnose and repair PC issues, with full test report.",
        "supports_secrets": False,
        "fields": [
            _field("reported_issue", "Reported Issue", "textarea"),
            _field("symptoms", "Symptoms", "textarea"),
            _field("initial_diagnosis", "Initial Diagnosis", "textarea"),
            _field("suspected_component", "Suspected Component", "text"),
            _field("test_results", "Test Results", "textarea"),
            _field("replaced_parts", "Replaced Parts", "textarea"),
            _field("final_diagnosis", "Final Diagnosis", "textarea"),
            _field("final_fix", "Final Fix", "textarea"),
            _field("warranty_note", "Warranty Note", "text"),
        ],
        "checklist": [
            "Visual inspection", "Reproduce issue", "Check temperatures", "Check storage health",
            "Check RAM", "Check PSU/GPU/CPU stability", "Check Windows logs",
            "Repair/replace faulty part", "Stress test", "Final report",
        ],
        "attachment_categories": ["Before photos", "Issue evidence", "Diagnostic screenshots", "Test results", "Final photos"],
    },
    {
        "name": "PC Cleaning",
        "category": "PC Cleaning",
        "description": "Deep cleaning of PC, optional thermal paste replacement.",
        "fields": [
            _field("dust_level", "Dust Level", "select", options=["Light", "Moderate", "Heavy", "Extreme"]),
            _field("thermal_paste", "Thermal Paste Replacement", "checkbox"),
            _field("temp_before", "Before Temperatures", "text"),
            _field("temp_after", "After Temperatures", "text"),
            _field("fans_cleaned", "Fans Cleaned", "checkbox"),
            _field("filters_cleaned", "Filters Cleaned", "checkbox"),
            _field("cable_management_touched", "Cable Management Touched", "checkbox"),
            _field("cleaning_notes", "Cleaning Notes", "textarea"),
        ],
        "checklist": [
            "Take before photos", "Remove panels", "Clean dust", "Clean filters",
            "Clean fans", "Optional repaste", "Check cables", "Take after photos", "Temperature test",
        ],
        "attachment_categories": ["Before photos", "Dust details", "Cleaning process", "After photos", "Temperature screenshots"],
    },
    {
        "name": "Laptop Service",
        "category": "Laptop Service",
        "fields": [
            _field("brand", "Laptop Brand", "text"),
            _field("model", "Laptop Model", "text"),
            _field("serial", "Serial Number", "text"),
            _field("reported_issue", "Reported Issue", "textarea"),
            _field("battery_condition", "Battery Condition", "text"),
            _field("storage_health", "Storage Health", "text"),
            _field("ram_config", "RAM Configuration", "text"),
            _field("thermal_condition", "Thermal Condition", "text"),
            _field("keyboard_condition", "Keyboard/Touchpad Condition", "text"),
            _field("display_condition", "Display Condition", "text"),
            _field("charger_included", "Charger Included", "checkbox"),
            _field("final_diagnosis", "Final Diagnosis", "textarea"),
        ],
        "checklist": [
            "Visual inspection", "Check charger", "Check battery", "Check storage health",
            "Check RAM", "Check temperatures", "Clean cooling if needed", "Repair/replace part",
            "Test keyboard/touchpad", "Test display", "Final report",
        ],
        "attachment_categories": ["Device photos", "Diagnostic screenshots", "Internal photos", "Final photos"],
    },
    {
        "name": "Console Service",
        "category": "Console Service",
        "fields": [
            _field("console_type", "Console Type", "select", options=["PlayStation 5", "PlayStation 4", "Xbox Series X/S", "Xbox One", "Nintendo Switch", "Other"]),
            _field("model", "Model", "text"),
            _field("serial", "Serial Number", "text"),
            _field("reported_issue", "Reported Issue", "textarea"),
            _field("cleaning_level", "Cleaning Level", "select", options=["Surface", "Deep", "Full Disassembly"]),
            _field("thermal_paste", "Thermal Paste", "checkbox"),
            _field("fan_noise_before", "Fan Noise Before", "text"),
            _field("fan_noise_after", "Fan Noise After", "text"),
            _field("storage_status", "Storage Status", "text"),
            _field("controller_notes", "Controller/Accessory Notes", "textarea"),
        ],
        "checklist": [
            "Take before photos", "Visual inspection", "Open console", "Clean dust",
            "Clean fan/heatsink", "Replace thermal paste", "Reassemble", "Test boot",
            "Test game load", "Take after photos",
        ],
        "attachment_categories": ["Before photos", "Internal photos", "Cleaning process", "After photos", "Test videos"],
    },
    {
        "name": "Apple / iPhone Service",
        "category": "Apple/iPhone",
        "fields": [
            _field("device_type", "Device Type", "select", options=["iPhone", "iPad", "MacBook", "iMac", "Apple Watch", "Other"]),
            _field("model", "Model", "text"),
            _field("imei", "Serial / IMEI", "text"),
            _field("os_version", "iOS / macOS Version", "text"),
            _field("reported_issue", "Reported Issue", "textarea"),
            _field("battery_health", "Battery Health", "text"),
            _field("storage_capacity", "Storage Capacity", "text"),
            _field("icloud_status", "iCloud Status Note", "text"),
            _field("backup_needed", "Data Backup Needed", "checkbox"),
            _field("accessories", "Accessories Included", "text"),
            _field("final_diagnosis", "Final Diagnosis", "textarea"),
        ],
        "checklist": [
            "Visual inspection", "Check display", "Check cameras", "Check speakers/microphones",
            "Check charging", "Check battery health", "Backup data if requested",
            "Perform service", "Final test", "Final report",
        ],
        "attachment_categories": ["Device photos", "Issue evidence", "Screenshots", "Final photos"],
    },
    {
        "name": "Networking / UniFi Setup",
        "category": "UniFi Setup",
        "supports_secrets": True,
        "fields": [
            _field("location", "Client Location", "text"),
            _field("isp", "ISP", "text"),
            _field("internet_speed", "Internet Speed", "text"),
            _field("router", "Router/Gateway Model", "text"),
            _field("switch", "Switch Model", "text"),
            _field("aps", "Access Points", "textarea"),
            _field("poe_devices", "PoE Devices", "textarea"),
            _field("vlans", "VLANs", "textarea"),
            _field("ssids", "SSIDs", "textarea"),
            _field("guest_wifi", "Guest Wi-Fi", "checkbox"),
            _field("dhcp_range", "DHCP Range", "text"),
            _field("dns", "DNS Settings", "text"),
            _field("pihole", "Pi-hole", "checkbox"),
            _field("vpn", "VPN", "checkbox"),
            _field("port_forwards", "Port Forwards", "textarea"),
            _field("static_ips", "Static IPs", "textarea"),
            _field("rack_notes", "Rack/Location Notes", "textarea"),
            _field("cable_runs", "Cable Runs", "textarea"),
            _field("topology_notes", "Topology Notes", "textarea"),
            _field("security_notes", "Security Notes", "textarea"),
        ],
        "checklist": [
            "Inspect existing network", "Backup current config", "Plan topology",
            "Configure gateway", "Configure switch", "Configure access points",
            "Configure Wi-Fi", "Configure VLANs", "Test LAN", "Test Wi-Fi coverage",
            "Test DNS", "Test VPN", "Document final topology", "Final handover",
        ],
        "attachment_categories": ["Network topology", "Rack photos", "Device photos", "Speed tests", "Coverage screenshots", "Configuration screenshots"],
    },
    {
        "name": "NAS / Server Setup",
        "category": "NAS/Server",
        "supports_secrets": True,
        "fields": [
            _field("hardware", "Server Hardware", "textarea"),
            _field("os", "Operating System", "text"),
            _field("storage_layout", "Storage Layout", "textarea"),
            _field("raid_config", "RAID/Configuration", "text"),
            _field("docker", "Docker", "checkbox"),
            _field("services", "Services Running", "textarea"),
            _field("backup_strategy", "Backup Strategy", "textarea"),
            _field("remote_access", "Remote Access Method", "text"),
            _field("security_notes", "Security Notes", "textarea"),
            _field("admin_url", "Admin URL", "url"),
        ],
        "checklist": [
            "Install OS", "Update system", "Configure storage", "Configure users",
            "Install Docker", "Deploy services", "Configure firewall",
            "Configure backups", "Test restart behavior", "Document access",
        ],
        "attachment_categories": ["Hardware photos", "Configuration screenshots", "Service screenshots", "Backup documentation", "Network diagrams"],
    },
    {
        "name": "Minecraft Server Hosting",
        "category": "Minecraft Server Hosting",
        "supports_secrets": True,
        "fields": [
            _field("mc_version", "Minecraft Version", "text"),
            _field("server_type", "Server Type", "select", options=["Vanilla", "Paper", "Spigot", "Fabric", "Forge", "Purpur"]),
            _field("java_version", "Java Version", "text"),
            _field("player_count", "Player Count", "number"),
            _field("ram_alloc", "RAM Allocation", "text"),
            _field("online_mode", "Online Mode", "checkbox"),
            _field("whitelist", "Whitelist Enabled", "checkbox"),
            _field("plugins", "Plugins", "textarea"),
            _field("mods", "Mods", "textarea"),
            _field("datapacks", "Datapacks", "textarea"),
            _field("world_name", "World Name", "text"),
            _field("seed", "Seed", "text"),
            _field("backup_schedule", "Backup Schedule", "text"),
            _field("port", "Port", "number"),
            _field("domain", "Domain/Subdomain", "url"),
            _field("proxy", "Proxy", "select", options=["None", "Velocity", "BungeeCord"]),
            _field("permissions_plugin", "Permissions Plugin", "text"),
            _field("economy_plugin", "Economy Plugin", "text"),
            _field("anticheat", "Anti-cheat", "text"),
            _field("startup_command", "Startup Command", "textarea"),
            _field("container_name", "Docker/Container Name", "text"),
            _field("hosting_machine", "Hosting Machine", "text"),
        ],
        "checklist": [
            "Create server directory/container", "Install correct Java", "Download server jar",
            "Accept EULA", "Configure server.properties", "Configure whitelist",
            "Install plugins/mods", "Configure permissions", "Configure backups",
            "Configure firewall/port forwarding/VPN", "Test player join",
            "Test performance", "Document admin access",
        ],
        "attachment_categories": ["Configuration files", "Plugin list", "Screenshots", "Performance screenshots", "Backup documentation"],
    },
    {
        "name": "Website / Hosting",
        "category": "Website/Hosting",
        "supports_secrets": True,
        "fields": [
            _field("project_name", "Project Name", "text"),
            _field("domain", "Domain", "url"),
            _field("hosting", "Hosting Provider/Server", "text"),
            _field("framework", "Framework", "text"),
            _field("repo_url", "Repository URL", "url"),
            _field("deployment_method", "Deployment Method", "text"),
            _field("env_vars", "Environment Variables", "textarea"),
            _field("ssl_status", "SSL Status", "select", options=["Active", "Pending", "Disabled"]),
            _field("backup_strategy", "Backup Strategy", "textarea"),
            _field("admin_url", "Admin URL", "url"),
            _field("notes", "Notes", "textarea"),
        ],
        "checklist": [
            "Check repository", "Configure environment", "Deploy app",
            "Configure domain/DNS", "Enable SSL", "Test production build",
            "Test forms/API", "Configure backups", "Document deployment",
        ],
        "attachment_categories": ["Screenshots", "Deployment logs", "DNS screenshots", "SSL screenshots", "Documentation"],
    },
    {
        "name": "Consultation",
        "category": "Consultation",
        "supports_devices": False,
        "fields": [
            _field("topic", "Consultation Topic", "text"),
            _field("client_goal", "Client Goal", "textarea"),
            _field("current_situation", "Current Situation", "textarea"),
            _field("recommendations", "Recommendations", "textarea"),
            _field("hardware_software", "Hardware/Software Suggested", "textarea"),
            _field("budget", "Budget", "text"),
            _field("followup_needed", "Follow-up Needed", "checkbox"),
            _field("followup_date", "Follow-up Date", "date"),
        ],
        "checklist": [
            "Understand client goal", "Inspect current situation", "Prepare recommendations",
            "Explain options", "Document conclusion", "Schedule follow-up if needed",
        ],
        "attachment_categories": ["Notes", "Screenshots", "Recommendations", "Documents"],
    },
    {
        "name": "Other",
        "category": "Other",
        "fields": [
            _field("custom_description", "Custom Description", "textarea"),
            _field("work_performed", "Work Performed", "textarea"),
            _field("result", "Result", "textarea"),
            _field("notes", "Notes", "textarea"),
        ],
        "checklist": [
            "Inspect situation", "Define task", "Complete work", "Test result", "Document outcome",
        ],
        "attachment_categories": ["General files", "Photos", "Documents"],
    },
]


async def seed_admin(db):
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@houstonlab.local")
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "ChangeMe123!")
    existing = await db.users.find_one({"$or": [{"email": admin_email}, {"username": admin_username}]})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(),
            "username": admin_username,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "HoustonLab Admin",
            "role": "admin",
            "must_change_password": True,
            "created_at": now_iso(),
        })


async def seed_templates(db):
    if await db.templates.count_documents({}) > 0:
        return
    for tpl in PREDEFINED_TEMPLATES:
        doc = {
            "id": new_id(),
            "name": tpl["name"],
            "category": tpl["category"],
            "description": tpl.get("description", ""),
            "fields": tpl.get("fields", []),
            "checklist": tpl.get("checklist", []),
            "timeline_types": ["Note", "Diagnosis", "Repair", "Part Installed", "Test", "Customer Update", "Payment", "Problem"],
            "attachment_categories": tpl.get("attachment_categories", []),
            "supports_devices": tpl.get("supports_devices", True),
            "supports_secrets": tpl.get("supports_secrets", False),
            "is_predefined": True,
            "created_at": now_iso(),
        }
        await db.templates.insert_one(doc)


async def seed_settings(db):
    if await db.settings.find_one({"_id": "app"}) is None:
        await db.settings.insert_one({
            "_id": "app",
            "brand_name": "HoustonLab",
            "accent_color": "#34D399",
            "currency": "CZK",
            "logo_url": None,
            "language": "en",
            "updated_at": now_iso(),
        })


async def seed_demo_data(db):
    if await db.clients.count_documents({}) > 0:
        return

    # Clients
    clients_data = [
        {"full_name": "Tomáš Novák", "phone": "+420 776 123 456", "email": "tomas.novak@example.com", "address": "Praha 7, Letná", "notes": "Long-time customer. Plays a lot of Cyberpunk."},
        {"full_name": "Markéta Svobodová", "phone": "+420 602 998 121", "email": "marketa.s@example.com", "address": "Brno – Královo Pole", "notes": "Cares about quiet PCs. No RGB."},
        {"full_name": "David Kratochvíl", "phone": "+420 731 553 200", "email": "kratochvil.d@example.com", "address": "Olomouc, Nová Ulice", "notes": "Streamer. PS5 + capture card setup."},
        {"full_name": "Café Atlas s.r.o.", "phone": "+420 222 000 999", "email": "tech@cafeatlas.cz", "address": "Praha 1, Karolíny Světlé", "notes": "B2B – UniFi network in three rooms."},
        {"full_name": "Eva Horáková", "phone": "+420 608 446 711", "email": "eva.h@example.com", "address": "Plzeň – Bory", "notes": "iPhone repairs only."},
        {"full_name": "Lukáš Černý", "phone": "+420 777 200 100", "email": "lukas.c@example.com", "address": "Hradec Králové", "notes": "Self-hosting enthusiast. Owns a Synology DS923+."},
    ]
    client_ids = []
    for c in clients_data:
        cid = new_id()
        client_ids.append(cid)
        await db.clients.insert_one({
            "id": cid, **c, "trust_notes": None, "created_at": now_iso(),
        })

    # Devices
    devices_data = [
        {"name": "Tomáš's Gaming Rig", "device_type": "Gaming PC", "brand": "Custom", "model": "AM5 build", "serial": "HL-PC-0001", "client_id": client_ids[0],
         "specs": {"cpu": "Ryzen 7 7800X3D", "gpu": "RTX 4080 Super", "ram": "32GB DDR5 6000", "storage": "2TB NVMe", "psu": "Corsair RM850x", "cooling": "NH-D15"}},
        {"name": "Markéta's Silent Workstation", "device_type": "Desktop PC", "brand": "Custom", "model": "Quiet build", "serial": "HL-PC-0002", "client_id": client_ids[1],
         "specs": {"cpu": "Ryzen 7 7700", "gpu": "RTX 4070", "ram": "32GB DDR5", "storage": "1TB NVMe", "cooling": "Noctua NH-U12A"}},
        {"name": "David's PS5", "device_type": "Console", "brand": "Sony", "model": "PS5 Slim", "serial": "PS5-9988-A12", "client_id": client_ids[2], "specs": {}},
        {"name": "Café Atlas — Dream Machine", "device_type": "Router", "brand": "UniFi", "model": "UDM Pro", "serial": "UDM-PRO-CAFE", "client_id": client_ids[3], "specs": {}},
        {"name": "Eva's iPhone 14 Pro", "device_type": "iPhone", "brand": "Apple", "model": "iPhone 14 Pro", "serial": "F2LX7Q3R", "client_id": client_ids[4], "specs": {}},
        {"name": "Lukáš's NAS", "device_type": "NAS", "brand": "Synology", "model": "DS923+", "serial": "DS923-LCERN", "client_id": client_ids[5], "specs": {}},
        {"name": "Tomáš's Laptop", "device_type": "Laptop", "brand": "Lenovo", "model": "Legion 5 Pro", "serial": "PF3X1Y2Z", "client_id": client_ids[0], "specs": {}},
    ]
    device_ids = []
    for d in devices_data:
        did = new_id()
        device_ids.append(did)
        await db.devices.insert_one({
            "id": did, **d, "notes": None, "status": "Active", "photos": [], "created_at": now_iso(),
        })

    # Find templates we just seeded
    tpl_by_name = {}
    async for t in db.templates.find({}, {"_id": 0}):
        tpl_by_name[t["name"]] = t

    # Helper to generate a checklist with some checked items
    def make_checklist(template_checklist, done_count):
        items = []
        for i, text in enumerate(template_checklist):
            done = i < done_count
            items.append({
                "id": new_id(),
                "text": text,
                "done": done,
                "note": None,
                "completed_at": now_iso() if done else None,
            })
        return items

    # Helper for timeline
    def make_timeline(entries):
        result = []
        for offset_days, type_, text in entries:
            ts = (datetime.now(timezone.utc) - timedelta(days=offset_days)).isoformat()
            result.append({"id": new_id(), "type": type_, "text": text, "customer_visible": False, "created_at": ts, "attachment_id": None})
        return result

    # Job code counter
    job_counter = 1
    def next_code():
        nonlocal job_counter
        c = f"HL-{job_counter:04d}"
        job_counter += 1
        return c

    # 1. Custom PC Build (Tomáš) — Completed Paid
    t = tpl_by_name["Custom PC Build"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "Custom Gaming Build — 7800X3D / RTX 4080S",
        "template_id": t["id"], "category": "Custom PC Build", "status": "Completed", "priority": "Normal",
        "client_id": client_ids[0], "device_id": device_ids[0],
        "received_date": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat(),
        "deadline": (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
        "completed_date": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
        "description": "High-end 1440p gaming build with focus on thermals and silence.",
        "internal_notes": "Customer brought components himself. Verified compatibility before assembly.",
        "customer_summary": "Build completed, all benchmarks within target. Stable at full load.",
        "tags": ["gaming", "AM5", "premium"],
        "custom_fields": {
            "cpu": "Ryzen 7 7800X3D", "gpu": "RTX 4080 Super",
            "motherboard": "ASUS ROG Strix B650E-F", "ram": "G.Skill Trident Z5 32GB DDR5-6000",
            "storage": "Samsung 990 Pro 2TB", "psu": "Corsair RM850x",
            "case": "Fractal North", "cooling": "Noctua NH-D15", "fans": "6× Noctua NF-A12x25",
            "os": "Windows 11 Pro 23H2", "bios_version": "1620", "xmp_enabled": True,
            "benchmark_results": "Cinebench R23: 18,400 multi / 1,950 single. 3DMark Time Spy: 22,800.",
            "temperature_notes": "CPU max 76°C @ R23. GPU max 64°C @ TimeSpy.",
            "cable_management_notes": "Full back-channel routing, no cables visible from main side.",
            "final_config_notes": "PBO -25mV curve. EXPO II profile. Quiet fan curve below 50°C.",
        },
        "checklist": make_checklist(t["checklist"], len(t["checklist"])),
        "finance": {"labor_price": 3500, "parts_price": 0, "discount": 0, "currency": "CZK",
                    "payment_status": "Paid", "payment_method": "Bank Transfer",
                    "payment_date": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
                    "payment_note": "Paid in full on handover.", "paid_amount": 3500},
        "timeline": make_timeline([
            (20, "Note", "Components received and inspected — all good."),
            (18, "Repair", "CPU + cooler installed. RAM seated. M.2 mounted."),
            (16, "Test", "POST successful first try. BIOS updated to 1620."),
            (14, "Test", "Stress test — 30 min Prime95 small FFT. Stable."),
            (12, "Test", "Benchmark run completed. Results within target range."),
            (10, "Customer Update", "Build complete. Ready for pickup."),
            (8, "Payment", "Paid 3500 CZK via bank transfer."),
        ]),
        "attachments": [], "secrets": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=20)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
    })

    # 2. PC Cleaning (Markéta) — Ready for Pickup, Unpaid
    t = tpl_by_name["PC Cleaning"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "Annual deep cleaning + repaste",
        "template_id": t["id"], "category": "PC Cleaning", "status": "Ready for Pickup", "priority": "Normal",
        "client_id": client_ids[1], "device_id": device_ids[1],
        "received_date": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
        "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "description": "Heavy dust buildup, NH-U12A repaste with Kryonaut.",
        "internal_notes": "Watch out for the front filter — clips fragile.",
        "tags": ["cleaning", "repaste"],
        "custom_fields": {"dust_level": "Heavy", "thermal_paste": True,
            "temp_before": "CPU 92°C / GPU 78°C", "temp_after": "CPU 71°C / GPU 65°C",
            "fans_cleaned": True, "filters_cleaned": True, "cable_management_touched": False,
            "cleaning_notes": "Filters were saturated. Customer using compressed air on his own — recommended professional clean every 12 months."},
        "checklist": make_checklist(t["checklist"], 8),
        "finance": {"labor_price": 800, "parts_price": 250, "discount": 0, "currency": "CZK",
                    "payment_status": "Unpaid", "payment_method": None, "payment_date": None,
                    "payment_note": None, "paid_amount": 0},
        "timeline": make_timeline([
            (3, "Note", "Device received. Visible heavy dust in front intake."),
            (2, "Repair", "Disassembled. Cleaned all fans + filters. Repasted CPU."),
            (1, "Test", "Reassembled. 30 min stress test. Temps dropped 21°C on CPU."),
        ]),
        "attachments": [], "secrets": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    })

    # 3. Console Service (David) — In Progress, Partial
    t = tpl_by_name["Console Service"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "PS5 fan noise + thermal paste replacement",
        "template_id": t["id"], "category": "Console Service", "status": "In Progress", "priority": "High",
        "client_id": client_ids[2], "device_id": device_ids[2],
        "received_date": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "deadline": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "description": "Loud fan during AAA games. Customer suspects dust buildup.",
        "tags": ["ps5", "thermal", "streamer"],
        "custom_fields": {"console_type": "PlayStation 5", "model": "Slim", "serial": "PS5-9988-A12",
            "reported_issue": "Fan ramping aggressively after 10 minutes of gameplay.",
            "cleaning_level": "Deep", "thermal_paste": True,
            "fan_noise_before": "Loud, audible 2m away",
            "fan_noise_after": "TBD",
            "storage_status": "OK", "controller_notes": "DualSense included, not required for service."},
        "checklist": make_checklist(t["checklist"], 5),
        "finance": {"labor_price": 1200, "parts_price": 200, "discount": 0, "currency": "CZK",
                    "payment_status": "Partial", "payment_method": "Cash",
                    "payment_date": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
                    "payment_note": "500 CZK deposit paid in cash.", "paid_amount": 500},
        "timeline": make_timeline([
            (2, "Note", "Device received with controller. Fan loud at idle."),
            (1, "Diagnosis", "Heavy dust on heatsink. Thermal paste pumped out."),
            (1, "Payment", "Deposit 500 CZK received."),
        ]),
        "attachments": [], "secrets": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    })

    # 4. UniFi Setup (Café Atlas) — Completed Paid
    t = tpl_by_name["Networking / UniFi Setup"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "Café Atlas — full UniFi network refresh",
        "template_id": t["id"], "category": "UniFi Setup", "status": "Completed", "priority": "High",
        "client_id": client_ids[3], "device_id": device_ids[3],
        "received_date": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat(),
        "deadline": (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
        "completed_date": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(),
        "description": "Replace old TP-Link gear with UDM Pro + 2× U6-Pro + 1× Switch 24-PoE.",
        "internal_notes": "VLAN 10 = staff, VLAN 20 = guest, VLAN 30 = POS.",
        "customer_summary": "Network rebuilt with VLAN segmentation, guest Wi-Fi and improved coverage on the second floor.",
        "tags": ["unifi", "b2b", "vlan"],
        "custom_fields": {"location": "Karolíny Světlé, Praha 1", "isp": "CZ.NIC fiber 1Gbit/200",
            "internet_speed": "950/210 Mbit", "router": "UniFi Dream Machine Pro",
            "switch": "UniFi Switch 24 PoE", "aps": "2× U6-Pro (ground floor + second floor)",
            "vlans": "VLAN 10 staff, VLAN 20 guest, VLAN 30 POS",
            "ssids": "Atlas-Staff, Atlas-Guest, Atlas-POS (hidden)",
            "guest_wifi": True, "dhcp_range": "10.10.10.0/24, 10.10.20.0/24, 10.10.30.0/24",
            "dns": "1.1.1.1 / 1.0.0.1", "pihole": False, "vpn": True,
            "port_forwards": "443→POS server", "static_ips": "POS server 10.10.30.10",
            "rack_notes": "Mounted in cellar, behind bar.",
            "cable_runs": "Cat6a runs through ceiling to second floor.",
            "topology_notes": "UDM-Pro → Switch 24 PoE → 2× U6-Pro",
            "security_notes": "Guest VLAN isolated. POS VLAN no inter-VLAN access."},
        "checklist": make_checklist(t["checklist"], len(t["checklist"])),
        "finance": {"labor_price": 12500, "parts_price": 0, "discount": 1000, "currency": "CZK",
                    "payment_status": "Paid", "payment_method": "Bank Transfer",
                    "payment_date": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat(),
                    "payment_note": "B2B invoice paid in full.", "paid_amount": 11500},
        "timeline": make_timeline([
            (15, "Note", "Site survey. Identified two dead zones on second floor."),
            (12, "Repair", "Old TP-Link gear removed. UDM Pro racked."),
            (10, "Repair", "Switch + APs installed and adopted."),
            (8, "Test", "Speed tests across all rooms — all >300 Mbit on 5GHz."),
            (7, "Customer Update", "Handover meeting. Trained staff on guest Wi-Fi voucher."),
            (6, "Payment", "B2B invoice paid in full."),
        ]),
        "attachments": [],
        "secrets": [],  # secrets added separately via API in real life
        "created_at": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat(),
    })

    # 5. NAS / Server (Lukáš) — Testing
    t = tpl_by_name["NAS / Server Setup"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "Synology DS923+ — initial config + Docker stack",
        "template_id": t["id"], "category": "NAS/Server", "status": "Testing", "priority": "Normal",
        "client_id": client_ids[5], "device_id": device_ids[5],
        "received_date": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat(),
        "deadline": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "description": "Configure DSM 7.2, SHR-2, Docker stack with Plex, *arr suite, Tailscale.",
        "tags": ["nas", "docker", "selfhost"],
        "custom_fields": {"hardware": "Synology DS923+, 32GB ECC, 4×16TB Ironwolf Pro",
            "os": "DSM 7.2.2", "storage_layout": "SHR-2, ~32TB usable",
            "raid_config": "SHR-2", "docker": True,
            "services": "Plex, Sonarr, Radarr, Prowlarr, qBittorrent, Tailscale, Vaultwarden",
            "backup_strategy": "Hyper Backup → external HDD + Backblaze B2",
            "remote_access": "Tailscale SSH only", "security_notes": "Admin port changed, 2FA on all accounts.",
            "admin_url": "https://lukas-nas.local:5001"},
        "checklist": make_checklist(t["checklist"], 7),
        "finance": {"labor_price": 4500, "parts_price": 0, "discount": 0, "currency": "CZK",
                    "payment_status": "Unpaid", "payment_method": None, "payment_date": None,
                    "payment_note": None, "paid_amount": 0},
        "timeline": make_timeline([
            (6, "Note", "NAS received with disks already installed."),
            (5, "Repair", "DSM 7.2 fresh install. SHR-2 volume created."),
            (4, "Repair", "Docker stack deployed. All services up."),
            (2, "Test", "Backup test. Restore validated successfully."),
        ]),
        "attachments": [], "secrets": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=6)).isoformat(),
        "updated_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
    })

    # 6. Minecraft Server Hosting (Tomáš) — In Progress
    t = tpl_by_name["Minecraft Server Hosting"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "Friends-only Paper 1.21 server with backups",
        "template_id": t["id"], "category": "Minecraft Server Hosting", "status": "In Progress", "priority": "Low",
        "client_id": client_ids[0], "device_id": None,
        "received_date": (datetime.now(timezone.utc) - timedelta(days=4)).isoformat(),
        "deadline": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
        "description": "Hosted on home server. Whitelist only. Daily backups to NAS.",
        "tags": ["minecraft", "paper", "selfhost"],
        "custom_fields": {"mc_version": "1.21.1", "server_type": "Paper", "java_version": "OpenJDK 21",
            "player_count": 8, "ram_alloc": "6G", "online_mode": True, "whitelist": True,
            "plugins": "EssentialsX, LuckPerms, CoreProtect, Vault, Dynmap",
            "world_name": "atlas-world", "seed": "-4729838273",
            "backup_schedule": "Daily 04:00 → /mnt/nas/backups/mc",
            "port": 25565, "domain": "mc.tomasnovak.dev",
            "proxy": "None", "permissions_plugin": "LuckPerms",
            "container_name": "mc-paper-atlas", "hosting_machine": "Lukáš's NAS"},
        "checklist": make_checklist(t["checklist"], 8),
        "finance": {"labor_price": 1500, "parts_price": 0, "discount": 0, "currency": "CZK",
                    "payment_status": "Unpaid", "payment_method": None, "payment_date": None,
                    "payment_note": None, "paid_amount": 0},
        "timeline": make_timeline([
            (4, "Note", "Server directory + Docker container created."),
            (3, "Repair", "Paper 1.21.1 jar deployed. server.properties tuned."),
            (2, "Repair", "Plugins installed. LuckPerms groups configured."),
            (1, "Test", "8 players joined. TPS solid at 20."),
        ]),
        "attachments": [], "secrets": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=4)).isoformat(),
        "updated_at": now_iso(),
    })

    # 7. Laptop Service (Tomáš) — Diagnosing
    t = tpl_by_name["Laptop Service"]
    await db.jobs.insert_one({
        "id": new_id(), "code": next_code(), "title": "Lenovo Legion 5 Pro — random shutdowns",
        "template_id": t["id"], "category": "Laptop Service", "status": "Diagnosing", "priority": "Urgent",
        "client_id": client_ids[0], "device_id": device_ids[6],
        "received_date": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "deadline": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "description": "Random shutdowns under gaming load. No BSOD.",
        "tags": ["laptop", "thermal", "urgent"],
        "custom_fields": {"brand": "Lenovo", "model": "Legion 5 Pro 16ARH7H", "serial": "PF3X1Y2Z",
            "reported_issue": "Random hard shutdowns after 15-20 min in games.",
            "battery_condition": "Healthy 92%", "storage_health": "Samsung 980 Pro - 4% wear",
            "ram_config": "2× 16GB DDR5 4800", "thermal_condition": "Throttling above 95°C",
            "keyboard_condition": "OK", "display_condition": "OK", "charger_included": True,
            "final_diagnosis": "Suspected dried thermal paste — recommend repaste + clean."},
        "checklist": make_checklist(t["checklist"], 4),
        "finance": {"labor_price": 1100, "parts_price": 250, "discount": 0, "currency": "CZK",
                    "payment_status": "Unpaid", "payment_method": None, "payment_date": None,
                    "payment_note": None, "paid_amount": 0},
        "timeline": make_timeline([
            (1, "Note", "Device received. Reproduced issue in 12 minutes."),
            (1, "Diagnosis", "HWiNFO log shows CPU hitting 102°C before shutdown."),
        ]),
        "attachments": [], "secrets": [],
        "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "updated_at": now_iso(),
    })


async def run_seeders(db):
    await seed_admin(db)
    await seed_templates(db)
    await seed_settings(db)
    await seed_demo_data(db)
