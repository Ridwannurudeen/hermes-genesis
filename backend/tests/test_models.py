import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from models.genome import Genome, TRAITS

def test_genome_defaults():
    g = Genome()
    for t in TRAITS:
        assert 0.0 <= getattr(g, t) <= 1.0

def test_genome_crossover_no_mutation():
    a = Genome(courage=1.0, cunning=0.0, loyalty=1.0, ambition=0.0, empathy=1.0, resilience=0.0)
    b = Genome(courage=0.0, cunning=1.0, loyalty=0.0, ambition=1.0, empathy=0.0, resilience=1.0)
    child = Genome.crossover(a, b, mutation_rate=0.0)
    for t in TRAITS:
        assert getattr(child, t) in (0.0, 1.0)

def test_genome_crossover_with_mutation():
    a = Genome(courage=0.5, cunning=0.5, loyalty=0.5, ambition=0.5, empathy=0.5, resilience=0.5)
    b = Genome(courage=0.5, cunning=0.5, loyalty=0.5, ambition=0.5, empathy=0.5, resilience=0.5)
    child = Genome.crossover(a, b, mutation_rate=1.0)
    diffs = [abs(getattr(child, t) - 0.5) for t in TRAITS]
    assert any(d > 0.001 for d in diffs)

def test_genome_fitness():
    g = Genome()
    f = g.fitness(survival=1.0, influence=0.8, goals=0.6, relationships=0.4)
    expected = round(0.3 * 1.0 + 0.25 * 0.8 + 0.25 * 0.6 + 0.2 * 0.4, 3)
    assert f == expected

def test_genome_clamp():
    a = Genome(courage=0.99, cunning=0.99, loyalty=0.99, ambition=0.99, empathy=0.99, resilience=0.99)
    b = Genome(courage=0.99, cunning=0.99, loyalty=0.99, ambition=0.99, empathy=0.99, resilience=0.99)
    for _ in range(100):
        child = Genome.crossover(a, b, mutation_rate=1.0)
        for t in TRAITS:
            assert 0.0 <= getattr(child, t) <= 1.0
