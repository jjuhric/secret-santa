export function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

export function performDraw(users) {
  if (users.length < 3) {
    return { success: false, message: 'Need at least 3 users across families to conduct the draw.' };
  }

  let validDraw = false;
  let attempts = 0;
  let assignments = {};
  
  while (!validDraw && attempts < 2000) {
    attempts++;
    
    let shuffledRecipients = [...users];
    for (let i = 0; i < 3; i++) {
      shuffledRecipients = shuffle(shuffledRecipients);
    }
    shuffledRecipients = shuffle(shuffledRecipients);
    
    validDraw = true;
    assignments = {};

    for (let i = 0; i < users.length; i++) {
      const buyer = users[i];
      const recipient = shuffledRecipients[i];

      if (buyer.id === recipient.id || (buyer.familyId && recipient.familyId && buyer.familyId.toLowerCase() === recipient.familyId.toLowerCase())) {
        validDraw = false;
        break;
      }

      assignments[buyer.id] = recipient.id;
    }
  }

  if (!validDraw) {
    return { success: false, message: 'Could not find a valid combination where no family member buys for their own family. Please make sure there are enough different families with balanced members.' };
  }

  return { success: true, assignments };
}
