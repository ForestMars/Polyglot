import os
import statistics

def count_words_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
            return len(text.split())
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return 0

def analyze_directory_word_counts(directory):
    word_counts = []
    file_word_map = {}

    for filename in os.listdir(directory):
        filepath = os.path.join(directory, filename)

        if os.path.isfile(filepath):
            word_count = count_words_in_file(filepath)
            word_counts.append(word_count)
            file_word_map[filename] = word_count

    if not word_counts:
        print("No readable files found.")
        return

    total_words = sum(word_counts)
    mean_words = statistics.mean(word_counts)
    median_words = statistics.median(word_counts)
    try:
        mode_words = statistics.mode(word_counts)
    except statistics.StatisticsError:
        mode_words = "No unique mode"

    print("\nWord count per file:")
    for file, count in file_word_map.items():
        print(f"  {file}: {count} words")

    print("\nSummary statistics:")
    print(f"  Total words: {total_words}")
    print(f"  Mean words per file: {mean_words:.2f}")
    print(f"  Median words per file: {median_words}")
    print(f"  Mode words per file: {mode_words}")

# Example usage
if __name__ == "__main__":
    directory_path = input("Enter the directory path: ").strip()
    analyze_directory_word_counts(directory_path)

