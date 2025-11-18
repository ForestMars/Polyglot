import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Contact {
  name: string;
  email: string;
}

export class ContactsService {
  private contactsPath: string;
  
  constructor() {
    this.contactsPath = join(__dirname, '..', 'config', 'contacts.txt');
  }
  
  private loadContacts(): Contact[] {
    if (!existsSync(this.contactsPath)) {
      return [];
    }
    
    const content = readFileSync(this.contactsPath, 'utf-8');
    const contacts: Contact[] = [];
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Parse "Name <email@example.com>" format
      const match = trimmed.match(/^(.+?)\s*<([^>]+@[^>]+)>$/);
      if (match) {
        contacts.push({
          name: match[1].trim(),
          email: match[2].trim()
        });
      }
    }
    
    return contacts;
  }
  
  /**
   * Resolve a recipient string to RFC 5322 format: "Name <email@example.com>"
   * 
   * Accepts:
   * - "Zeta" (first name lookup)
   * - "Zeta Jones" (full name lookup)
   * - "lostjournals" (email username lookup)
   * - "lostjournals@gmail.com" (direct email)
   * - "Zeta Jones <lostjournals@gmail.com>" (already formatted)
   * - "Zeta Jones lostjournals@gmail.com" (name + email without brackets)
   */
resolve(input: string): string {
  const trimmed = input.trim();
  const contacts = this.loadContacts();
  
  // If already in RFC 5322 format with angle brackets, check and add if needed
  const rfc5322Match = trimmed.match(/^(.+?)\s*<([^>]+@[^>]+)>$/);
  if (rfc5322Match) {
    const name = rfc5322Match[1].trim();
    const email = rfc5322Match[2].trim();
    
    const contact = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!contact) {
      this.addContact(name, email);
    }
    
    return trimmed;
  }
  
  // If format is "Name email@example.com" (without angle brackets), normalize and add if needed
  const nameEmailMatch = trimmed.match(/^(.+?)\s+([^\s]+@[^\s]+)$/);
  if (nameEmailMatch) {
    const name = nameEmailMatch[1].trim();
    const email = nameEmailMatch[2].trim();
    
    const contact = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!contact) {
      this.addContact(name, email);
    }
    
    return `${name} <${email}>`;
  }
  
  // If it's just an email address, check and add if needed
  if (trimmed.includes('@')) {
    const email = trimmed;
    const contact = contacts.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (contact) {
      return `${contact.name} <${contact.email}>`;
    }
    // Email not in contacts - add it with email as the name
    this.addContact(email, email);
    return email;
  }
  
  // Try to find by first name
  const byFirstName = contacts.find(c => 
    c.name.split(' ')[0].toLowerCase() === trimmed.toLowerCase()
  );
  if (byFirstName) {
    return `${byFirstName.name} <${byFirstName.email}>`;
  }
  
  // Try to find by full name
  const byFullName = contacts.find(c => 
    c.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (byFullName) {
    return `${byFullName.name} <${byFullName.email}>`;
  }
  
  // Try to find by email username (part before @)
  const byUsername = contacts.find(c => 
    c.email.split('@')[0].toLowerCase() === trimmed.toLowerCase()
  );
  if (byUsername) {
    return `${byUsername.name} <${byUsername.email}>`;
  }
  
  // Not found - throw error
  throw new Error(`Contact not found: "${input}"`);
}
  
  /**
   * Add a new contact to the contacts file
   */
  addContact(name: string, email: string): void {
    const contacts = this.loadContacts();
    
    // Check if contact already exists
    const exists = contacts.find(c => 
      c.email.toLowerCase() === email.toLowerCase()
    );
    
    if (exists) {
      console.log(`Contact ${email} already exists`);
      return;
    }
    
    // Append to file
    const line = `${name} <${email}>\n`;
    writeFileSync(this.contactsPath, line, { flag: 'a' });
    console.log(`Added contact: ${name} <${email}>`);
  }
}

export const contactsService = new ContactsService();
