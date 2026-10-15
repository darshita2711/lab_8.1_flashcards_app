# Flashcards app - reflection

- **Where AI saved time:** AI helped scaffold the page layout, responsive styles, deck and card interactions, local storage, study mode, and search. That let me spend more time reviewing how the pieces work together.
- **AI bug found and fixed:** The generated card-delete flow could leave keyboard focus on a toolbar button after deleting the last matching card, even though that toolbar was hidden. I changed the focus destination to the visible empty-state action.
- **Code refactored for clarity:** I kept card filtering in one helper so rendering, keyboard navigation, and the match count use the same rule:

  ```js
  function matchingCards(deck = activeDeck()) {
      if (!deck) return [];
      const query = searchQuery.trim().toLocaleLowerCase();
      if (!query) return deck.cards;
      return deck.cards.filter((item) =>
          `${item.question} ${item.answer}`.toLocaleLowerCase().includes(query),
      );
  }
  ```

- **Accessibility improvement:** The app now provides labeled empty states with next-step buttons, hides decorative SVG icons from screen readers, and moves focus to a useful visible control after deleting the last card.
- **Prompt changes that improved output:** Requests became more specific about behavior and constraints - for example, naming `enterStudyMode(deckId)`, requiring listener cleanup, specifying delegated card events, and setting search debounce to 300 ms with a match count. That produced changes that were easier to implement and review than broad feature requests.
