export function getCurrentDate() {
  const now = new Date();

  const year = now.getFullYear(); // 4-digit year
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 2-digit month (0-based, so +1)
  const day = String(now.getDate()).padStart(2, "0"); // 2-digit day

  return `${year}-${month}-${day}`;
}

export function createUUID() {
  let uuid = getCurrentDate() + Date.now();
  return uuid;
}

export const addEventListenerToClass = (
  className: string,
  eventType: string,
  action: any
) => {
  document.querySelectorAll(className).forEach((elem) => {
    elem.addEventListener(eventType, action);
  });
};

export class MissingElementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Missing HTML Element";
  }
}

export function replacer(key: string, value: any) {
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // Convert Map to array of key-value pairs
    };
  } else {
    return value;
  }
}

export function reviver(key: string, value: any) {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return new Map(value.value); // Convert back to Map from array of key-value pairs
    }
  }
  return value;
}

export const isOverflown = ({
  clientWidth,
  clientHeight,
  scrollWidth,
  scrollHeight,
}: {
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}): boolean => {
  return scrollHeight > clientHeight || scrollWidth > clientWidth;
};
